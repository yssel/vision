import { authenticate, authenticateRest } from './fetchActions';

function removeDuplicatesBy(keyFn, array) {
  var mySet = new Set();
  return array.filter(function(x) {
    var key = keyFn(x), isNew = !mySet.has(key);
    if (isNew) mySet.add(key);
    return isNew;
  });
}

export async function checkParent(user, repo, sha){
	let child = await fetchCommit(user, repo, sha)
	let child_date = new Date(child.commit.committer.date)
	let valid = true
	for(let x=0; x<child.parents.length; x++){
		let fetched_parent = await fetchCommit(user, repo, child.parents[x].sha)
		if(new Date(fetched_parent.commit.committer.date) - child_date > 0){
			valid = false
			break;
		}
	}

	return valid
}

async function fetchFilesReq(user, repo, sha){
	let link = `https://api.github.com/repos/${user}/${repo}/commits/${sha}`;
	let response = await authenticateRest(link, true);
	return response.files;
}

export async function fetchCommit(user, repo, sha){
	let link = `https://api.github.com/repos/${user}/${repo}/commits?per_page=1&sha=${sha}`
	let response = await authenticateRest(link, true)	
	return response[0]
}

export async function fetchBranchCommitsCount(user, repo, branch) {
	let link = `https://api.github.com/repos/${user}/${repo}/commits?sha=${branch}&per_page=1`
	// fetch header 
	let response = await authenticateRest(link)
	let headerLink = response.headers.get('Link')
	// Parse link to get last page
	let lastPage = headerLink.match(/&page=(\d*)>; rel="last"/)[1]
	
	return Number(lastPage)
}

export async function fetchFirstCommit(user, repo){
	let link = `https://api.github.com/repos/${user}/${repo}/commits?per_page=1`
	// fetch header 
	let response = await authenticateRest(link)
	let headerLink = response.headers.get('Link')
	if(headerLink){
		let lastPage = headerLink.match(/&page=(\d*)>; rel="last"/)[1]
		// Parse link to get last page
		// fetch init commit
		let initCommitLink = `https://api.github.com/repos/${user}/${repo}/commits?per_page=1&page=${lastPage}`
		let initCommit = await authenticateRest(initCommitLink, true)
		return initCommit
	}else{
		let initCommit = await authenticateRest(link, true)
		return initCommit
	}
}

async function fetchFrom(dispatch, user, repo, type, point){
	let link;
	let response;

	try{
		// Get commit HASH of point (branch/tag/commit)
		// ------------------
		let hash = null
		switch(type){
			case 'BRANCH':{
				link = `https://api.github.com/repos/${user}/${repo}/commits?sha=${point}&per_page=1`;
				response = await authenticateRest(link, true);
				hash = response[0].sha
				break;
			}

			case 'TAG': {
				link = `https://api.github.com/repos/${user}/${repo}/git/refs/tags/${point}`;
				response = await authenticateRest(link,true);
				if(response.object.type === 'tag'){
					hash = response.object.sha;
					link = `https://api.github.com/repos/${user}/${repo}/git/tags/${hash}`;
					response = await authenticateRest(link, true);
					hash = response.object.sha
				}else{
					hash = response.object.sha
				}
				break;
			}

			case 'COMMIT': {
				hash = point
				break;
			}

			default:
				break;
		}

		// Get init commit of repo for comparison
		// ------------------
		link = `https://api.github.com/repos/${user}/${repo}/commits?per_page=1`
		// fetch header 
		response = await authenticateRest(link)
		let headerLink = response.headers.get('Link')
		// Parse link to get last page
		let lastPage = headerLink.match(/&page=(\d*)>; rel="last"/)[1]
		// fetch init commit
		link = `https://api.github.com/repos/${user}/${repo}/commits?per_page=1&page=${lastPage}`
		let initCommit = await authenticateRest(link, true)
		initCommit = initCommit[0]

		// Compare 1st commit...point &&
		//    fetch the 1st batch of commits in between
		// ------------------
		link = `https://api.github.com/repos/${user}/${repo}/compare/${initCommit.sha}...${hash}`;
		response = await authenticateRest(link, true);

		let commits = response.commits.reverse();
		// 1st batch is complete
		if( response.total_commits.length === 49 && response.total_commits === commits.length ){
			// Add the base commit at the end to complete commits
			commits = commits.concat(response.base_commit)
		}else{
			commits = commits.slice(0,50)
		}
		// 1st batch is INcomplete
		// else{
			// let lastDate = commits[commits.length-1].committer.date;
			// let totalCommits = response.total_commits + 1; // +1 for base commit
			
			// while(commits.length < totalCommits){
			// 	link = `https://api.github.com/repos/${user}/${repo}/commits?sha=${hash}&per_page=100&&until=${lastDate}`
			// 	response = await authenticateRest(link, true);
			// 	lastDate = response[response.length - 1].commit.committer.date
			// 	commits = commits.concat(response.slice(1)); // don't include duplicate last commit
			// }
		// }

		// Return commits
		dispatch({ 
			type: "FETCH_COMMITS_FULFILLED",
			payload: {
				commits
			} 
		})

	}catch(err){
		dispatch({ 
			type: "FETCH_COMMITS_REJECTED",
			payload: {
				errors: err
			} 
		})
	}
}

async function fetchRepoCommits(username, reponame, branchCursor = null, untilDate = null, sinceDate = null){
	const commitsFetch = authenticate().next().value
	let query = `query {
	  repository(owner: "${username}", name: "${reponame}") {
		# Fetch branches
	    refs(first: 100, refPrefix: "refs/heads/", after: ${branchCursor}) {
	      edges{
	        node {
	        name
	        target {
			# Fetch 100 Commits per branch
	        ...on Commit {
	        history(first: 50, until: ${untilDate ? `"${untilDate}"` : null }){
				edges{
					node{
						sha: oid
						message
						html_url: url
						author {
							user { name }
							name
							avatarUrl
						}
						committer{
							user { name }
							name
							avatarUrl
						}
						committedDate
						parents(first: 2){
							edges{
								node{
									sha: oid
								}
							}
						}
					}
				}
	            }
	            }
	          }
	        }
	      }
	      pageInfo {
	        endCursor
	        hasNextPage
	      }
	    }
	  }
	}`

	let response = await commitsFetch({ query })
	return response
}

async function fetchPageCommits(username, reponame, branchCursor = null, untilDate = null, sinceDate = null){
	const commitsFetch = authenticate().next().value
	let query = `query {
	  repository(owner: "${username}", name: "${reponame}") {
		# Fetch branches
	    refs(first: 100, refPrefix: "refs/heads/", after: ${branchCursor}) {
	      edges{
	        node {
	        name
	        target {
			# Fetch 100 Commits per branch
	        ...on Commit {
	        history(first: 51, until: ${untilDate ? `"${untilDate}"` : null }){
				edges{
					node{
						sha: oid
						message
						html_url: url
						author {
							user { name }
							name
							avatarUrl
						}
						committer{
							user { name }
							name
							avatarUrl
						}
						committedDate
						parents(first: 2){
							edges{
								node{
									sha: oid
								}
							}
						}
					}
				}
	            }
	            }
	          }
	        }
	      }
	      pageInfo {
	        endCursor
	        hasNextPage
	      }
	    }
	  }
	}`

	let response = await commitsFetch({ query })
	return response
}

async function fetchAllCommits(dispatch, username, reponame, lastDate){
	try {
		// While last commit is not yet fetched
		let success = true
		let repoCommits = []
		while(success){
			let fetched_commits = [] // collects fetched commits for all branches
			// Fetch 100 commits from 100 branch (API Limit)
			let response = await fetchRepoCommits(username, reponame, null, lastDate)
			if(!response.errors){
				// Initial 100 branches - 50 commits
				response.data.repository.refs.edges.map(
					(branch) => 
						fetched_commits = fetched_commits.concat(branch.node.target.history.edges))

				// While not all branch has been visited
				while(response.data.repository.refs.pageInfo.hasNextPage){
					let cursor = response.data.repository.refs.pageInfo.endCursor
					response = await fetchRepoCommits(username, reponame, cursor, lastDate)
					//Add newly fetched commits each branch 
					if(!response.errors){
						// eslint-disable-next-line
						response.data.repository.refs.edges.map((branch) => fetched_commits = fetched_commits.concat(branch.node.target.history.edges))
					}else{
						// An error has occured
						dispatch({ 
							type: "FETCH_COMMITS_REJECTED",
							payload: {
								errors: response.errors
							} 
						})
						success = false
						break
					}
				}

				// Remove duplicates & sort latest to oldest
				if(success){
					// Restructure commit object
					fetched_commits = fetched_commits.map(
						(commit) =>
						{
							return({
								sha: commit.node.sha,
								html_url: commit.node.html_url,
								commit: {
									author: commit.node.author,
									committer: {
										...commit.node.committer,
										date: commit.node.committedDate,
									},
									message: commit.node.message,
								},
								parents: commit.node.parents.edges.map((parent) => parent.node)
							})
						}
					)

					fetched_commits = removeDuplicatesBy(commits => commits.sha, fetched_commits);
					console.log('hiii', fetched_commits)
					fetched_commits.sort(function(a, b) {
						a = new Date(a.commit.committer.date);
						b = new Date(b.commit.committer.date);
						return a>b ? -1 : a<b ? 1 : 0;
					});

					// sliced because all beyond 50 are not connected 
					// Add to fetched repo commits
					repoCommits = repoCommits.concat(fetched_commits.slice(0, 50))
					break
				}else{
					break
				}
			}else{
				dispatch({ 
					type: "FETCH_COMMITS_REJECTED",
					payload: {
						errors: response.errors
					} 
				})
				success = false
			}
		}

		// Fetching is done
		if(success){
			// Return commits
			dispatch({ 
				type: "FETCH_COMMITS_FULFILLED",
				payload: {
					commits: repoCommits
				} 
			})
		}

	}catch(err){
		dispatch({ 
			type: "FETCH_COMMITS_REJECTED",
			payload: {
				errors: err
			} 
		})
	}
}

async function pageFrom(user, repo, type, point, lastDate){
	let link;
	let response;

	try{
		// Get commit HASH of point (branch/tag/commit)
		// ------------------
		let hash = null
		switch(type){
			case 'BRANCH':{
				link = `https://api.github.com/repos/${user}/${repo}/commits?sha=${point}&per_page=1`;
				response = await authenticateRest(link, true);
				hash = response[0].sha
				break;
			}

			case 'TAG': {
				link = `https://api.github.com/repos/${user}/${repo}/git/refs/tags/${point}`;
				response = await authenticateRest(link,true);
				if(response.object.type === 'tag'){
					hash = response.object.sha;
					link = `https://api.github.com/repos/${user}/${repo}/git/tags/${hash}`;
					response = await authenticateRest(link, true);
					hash = response.object.sha
				}else{
					hash = response.object.sha
				}
				break;
			}

			case 'COMMIT': {
				hash = point
				break;
			}

			default:
				break;
		}

		link = `https://api.github.com/repos/${user}/${repo}/commits?sha=${hash}&per_page=51&&until=${lastDate}`
		response = await authenticateRest(link, true);
		let commits = response.slice(1)
		return commits
	}catch(err){
		return false
	}
}

async function pageAllCommits(username, reponame, lastDate){
	try {
		let success = true
		let repoCommits
		while(success){
			let fetched_commits = [] // collects fetched commits for all branches
			let response = await fetchPageCommits(username, reponame, null, lastDate)
			if(!response.errors){
				// Fetch 51 commits from 100 branch (PAGE)
				// First is disregarded because it's a duplicate of last commit
				response.data.repository.refs.edges.map(
					(branch) => 
						fetched_commits = fetched_commits.concat(branch.node.target.history.edges))

				// While not all branch has been visited
				while(response.data.repository.refs.pageInfo.hasNextPage){
					let cursor = response.data.repository.refs.pageInfo.endCursor
					response = await fetchPageCommits(username, reponame, cursor, lastDate)
					// Add newly fetched commits each branch 
					if(!response.errors){
						// eslint-disable-next-line
						response.data.repository.refs.edges.map((branch) => fetched_commits = fetched_commits.concat(branch.node.target.history.edges))
					}else{
						success = false
						break
					}
				}


				// Remove duplicates & sort latest to oldest
				if(success){
					// Restructure commit object
					fetched_commits = fetched_commits.map(
						(commit) =>
						{
							return({
								sha: commit.node.sha,
								html_url: commit.node.html_url,
								commit: {
									author: commit.node.author,
									committer: {
										...commit.node.committer,
										date: commit.node.committedDate,
									},
									message: commit.node.message,
								},
								parents: commit.node.parents.edges.map((parent) => parent.node)
							})
						}
					)

					fetched_commits = removeDuplicatesBy(commits => commits.sha, fetched_commits);
					fetched_commits.sort(function(a, b) {
						a = new Date(a.commit.committer.date);
						b = new Date(b.commit.committer.date);
						return a>b ? -1 : a<b ? 1 : 0;
					});

					// sliced because all beyond 50 are not connected 
					// Add to fetched repo commits
					repoCommits = fetched_commits.slice(1, 51)
					break
				}else{
					break
				}
			}else{
				success = false
			}
		}

		// Fetching is done
		if(success){
			return repoCommits
		}

	}catch(err){
		return false
	}
}

export async function pageCommits(username, reponame, mode='ALL', fetchPoint=null, lastDate=null){
	let commits
	switch (mode) {
		case 'ALL':
			commits = await pageAllCommits(username, reponame, lastDate);
			return commits
		case 'BRANCH':
			commits = await pageFrom(username, reponame, 'BRANCH', fetchPoint, lastDate)
			return commits
		case 'TAG':
			commits = await pageFrom(username, reponame, 'TAG', fetchPoint, lastDate)
			return commits
		case 'COMMIT':
			commits = await pageFrom(username, reponame, 'COMMIT', fetchPoint, lastDate)
			return commits
		default:
			return null;
	}
}

export function fetchCommits(username, reponame, mode='ALL', fetchPoint=null, lastDate=null){
	return async function (dispatch) {
		dispatch({ type: "FETCH_COMMITS" })
		switch (mode) {
			case 'ALL':
				await fetchAllCommits(dispatch, username, reponame, lastDate)
				break;
			case 'BRANCH':
				await fetchFrom(dispatch, username, reponame, 'BRANCH', fetchPoint)
				break;
			case 'TAG':
				await fetchFrom(dispatch, username, reponame, 'TAG', fetchPoint)
				break;
			case 'COMMIT':
				await fetchFrom(dispatch, username, reponame, 'COMMIT', fetchPoint)
				break;
			default:
				break;
		}
	}
}

export function updateCommits(commits){
	return {
		type: "UPDATE_COMMITS",
		payload: { commits }
	}
}

export function updatePageCommits(commits, page){
	return {
		type: "UPDATE_PAGE_COMMITS",
		payload: { commits, page }
	}
}

export function fetchFiles(user, repo, sha, index){
	return async function (dispatch){
		dispatch({ type: 'FETCH_COMMIT_FILES'})

		try{
			let response = await fetchFilesReq(user, repo, sha)
			if(!response.errors)
				dispatch({
					type: 'FETCH_COMMIT_FILES_FULFILLED',
					payload: {
						index,
						files: response
					}
				})
			else{
				dispatch({ 
					type: "FETCH_COMMIT_FILES_REJECTED",
					payload: {
						errors: response.errors
					} 
				})
			}

		}catch(err){
			dispatch({ 
				type: "FETCH_COMMIT_FILES_REJECTED",
				payload: {
					errors: err
				} 
			})
		}

	}
}
import { authenticate, authenticateRest } from './fetchActions';

async function fetchInitCommit(user, repo){
	let link = `https://api.github.com/repos/${user}/${repo}/commits?per_page=1`
	// fetch header 
	let response = await authenticateRest(link)
	let headerLink = response.headers.get('Link')
	// Parse link to get last page
	let lastPage = headerLink.match(/&page=(\d*)>; rel="last"/)[1]
	// fetch init commit
	let initCommitLink = `https://api.github.com/repos/${user}/${repo}/commits?per_page=1&page=${lastPage}`
	let initCommitDate = await authenticateRest(initCommitLink, true)

	initCommitDate = initCommitDate[0].commit.committer.date
	return initCommitDate
}

async function fetchRepoCommits(username, reponame, branchCursor = null, untilDate = null, sinceDate = null){
	const commitsFetch = authenticate().next().value

	let query = `query($owner:String!, $name:String!, $branchCursor: String, $untilDate: GitTimestamp) {
	  repository(owner: $owner, name: $name) {
		# Fetch branches
	    refs(first: 14, refPrefix: "refs/heads/", after: $branchCursor) {
	      edges{
	        node {
	        name
			id
	        target {
			# Fetch 100 Commits per branch
	        ...on Commit {
	        history(first: 100, until: $untilDate){
					totalCount
					edges{
						cursor
						node{
							id
							oid
							message
							author{
								name
								avatarUrl
							}
							committedDate
							url
							additions
							deletions
							parents(first: 2){
								edges{
									node{
										oid
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

	let variables = {
		owner: 	username,
		name: 	reponame,
		branchCursor: branchCursor,
		untilDate: untilDate
	}

	let response = await commitsFetch({ query, variables })
	return response
}

function removeDuplicatesBy(keyFn, array) {
  var mySet = new Set();
  return array.filter(function(x) {
    var key = keyFn(x), isNew = !mySet.has(key);
    if (isNew) mySet.add(key);
    return isNew;
  });
}

export function fetchCommits(username, reponame, untilDate = null, sinceDate = null){
	return async function (dispatch) {
		dispatch({ type: "FETCH_COMMITS" })

		let firstCommitDate = await fetchInitCommit(username, reponame) 
		let lastDate = null
		try {
			// While last commit is not yet fetched
			let success = true
			let fetching = true
			let firstFetch = true
			let repoCommits = []
			while(success && fetching){
				let fetched_commits = [] // collects fetched commits for all branches
				// Fetch 100 commits from 100 branch (API Limit)
				let response = await fetchRepoCommits(username, reponame, null, lastDate)
				if(!response.errors){
					// Initial 100 branches - 100 commits
					response.data.repository.refs.edges.map((branch) => fetched_commits = fetched_commits.concat(branch.node.target.history.edges))

					// While not all branch has been visited
					while(response.data.repository.refs.pageInfo.hasNextPage){
						let cursor = response.data.repository.refs.pageInfo.endCursor
						response = await fetchRepoCommits(username, reponame, cursor, lastDate)
						//Add newly fetched commits each branch 
						if(!response.errors){
							response.data.repository.refs.edges.map(
								(branch) => 
									fetched_commits = fetched_commits.concat(branch.node.target.history.edges))
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
						fetched_commits = fetched_commits.map((commit) => commit.node)
						fetched_commits = removeDuplicatesBy(commits => commits.oid, fetched_commits);
						fetched_commits.sort(function(a, b) {
							a = new Date(a.committedDate);
							b = new Date(b.committedDate);
							return a>b ? -1 : a<b ? 1 : 0;
						});

						// Add to fetched repo commits
						if(firstFetch){
							repoCommits = repoCommits.concat(fetched_commits.slice(0, 100))
							firstFetch = false
						}else{
							repoCommits = repoCommits.concat(fetched_commits.slice(1, 99))
						}
						// Get last date
						let lastDate = repoCommits[repoCommits.length-1].committedDate
						if(lastDate === firstCommitDate) {
							// All commits fetched
							fetching = false
							break
						}
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
}

export function updateCommits(commits){
	return {
		type: "UPDATE_COMMITS",
		payload: { commits }
	}
}

export function fetchInitCommitDate(username, reponame){
	return async function (dispatch){

	}
}
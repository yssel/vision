import { authenticate, authenticateRest } from './fetchActions'

export async function fetchMilestonesCount(username, reponame){
	const milestonesFetch = authenticate().next().value

	let query = `
	query {
		repository(owner: "${username}", name: "${reponame}"){
			open: milestones(last: 1, states: OPEN){
				totalCount
			}
			all: milestones(last: 1){
				totalCount
			}
		}
	}`

	let response = await milestonesFetch({ query })
	return { open: response.data.repository.open.totalCount, all: response.data.repository.all.totalCount }
}

export async function fetchMilestones(username, reponame){
	let link = `https://api.github.com/repos/${username}/${reponame}/milestones?sort=completeness`
	let response = await authenticateRest(link)
	let headerLink = response.headers.get('Link')
	if(headerLink){
		let milestones = []
		let page = 1
		let lastPage = Number(headerLink.match(/page=(\d*)>; rel="last"/)[1])
		while(page <= lastPage){
			let page_link = `${link}&page=${page}`
			response = await authenticateRest(page_link, true)
			milestones = milestones.concat(response)
			page++
		}
		return milestones
	}else{
		response = await authenticateRest(link, true)
		return response
	}
}
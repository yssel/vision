import { authenticate, authenticateRest } from './fetchActions'

export async function fetchMilestonesCount(username, reponame){
	const milestonesFetch = authenticate().next().value

	let query = `
	query {
		repository(owner: ${username}, name: ${reponame}){
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
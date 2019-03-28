import { authenticate, authenticateRest } from './fetchActions';

export async function getCommitActivity (user, repo) {
	let link = `https://api.github.com/repos/${user}/${repo}/stats/commit_activity`
	// fetch header 
	let response = await authenticateRest(link, true)	
	return response
}
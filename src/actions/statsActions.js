import { authenticate, authenticateRest } from './fetchActions';

export async function getCommitActivity (user, repo) {
	let link = `https://api.github.com/repos/${user}/${repo}/stats/commit_activity`
	// fetch header 
	let response = await authenticateRest(link, true)	
	return response
}

export function sortByDay(fetched, type, last=false){
	let data = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [], 9: [], 10: [], 11: [], 12: [], 13: []}
	let keyword = last ? (type==='issue' ? 'closedAt' : 'mergedAt') : 'createdAt'
	let today = new Date()
	let sunday = new Date(today.setDate(today.getDate()-7-today.getDay()))
	sunday.setHours(0,0,0,0)

	fetched.map((d) => {
		if(d[keyword]){
			let date = new Date(d[keyword])
			date.setHours(0,0,0,0)
			let day = Math.round((date-sunday)/(1000*60*60*24))
			data[day].push(d)
		}
	})

	return data
}
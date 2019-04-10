import { createApolloFetch } from 'apollo-fetch'

// Returns an authenticated fetch
// Usage: 
// const fetch = authenticate.next().value
export function* authenticate(){
	const uri = 'https://api.github.com/graphql'
	const fetch = createApolloFetch({ uri })
	fetch.use(({ request, options }, next) => {
		// Create the headers object if needed.
		if (!options.headers) {
			options.headers = {}
		}

		options.headers['Access-Control-Request-Headers'] = 'Content-Type, Authorization'
		options.headers['authorization'] = 'Bearer 31b33190759de454348a4a70a3bc93420e62faba'
		options.headers['Content-Type'] = 'application/json'
		options.withCredentials = true
		next()
	})
	yield fetch
}

export async function authenticateRest(url, json=false){
	var bearer = 'Bearer 31b33190759de454348a4a70a3bc93420e62faba';
	// var bearer = 'Bearer c43284ae83a0aadc7025181c9ad75e29008ac5b3';
	
	let response
	if(json){
		response = await fetch(url, {
		method: 'GET',
		withCredentials: true,
		headers: {
		    'Authorization': bearer,
		    'Content-Type': 'application/json'}
		}).then(function(response) { return response.json() })
	}else{
		response = await fetch(url, {
		method: 'GET',
		withCredentials: true,
		headers: {
		    'Authorization': bearer,
		    'Content-Type': 'application/json'}
		})	
	}
	
	return response
}
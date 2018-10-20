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
		options.headers['authorization'] = 'Bearer 31b33190759de454348a4a70a3bc93420e62faba'

		next()
	})

	yield fetch
}
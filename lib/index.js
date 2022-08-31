import { pathToRegexp } from 'path-to-regexp'


function routeMapToPlainEntries (routeMap)
{
	let entries = []

	for (const [key, next] of Object.entries(routeMap)) {

		const keyIsMethod = !key.startsWith('/')
		const nextIsMap = typeof next === 'object'

		const baseEntry = keyIsMethod
			? { method: key }
			: { path: key }

		if (nextIsMap) {
			for (const subEntry of flattenRouteMap(next)) {
				entries.push({
					...baseEntry,
					...subEntry,
					path: (baseEntry.path ?? '') + (subEntry.path ?? ''),
				})
			}
		} else {
			newEntries.push({
				...baseEntry,
				endpoint: next,
			})
		}
	}

	return entries
}

function methodToRegex (method)
{
	return new RegExp(`^${method}\$`, 'i')
}

function pathToRegex (path)
{
	let keys = []
	let regex = pathToRegexp(path, keys)

	return [regex, keys.map(k => k.name)]
}

function routeMapToEntries (routeMap)
{
	return routeMapToPlainEntries(routeMap)
		.map(entry => {
			let methodRegex = null
			let pathRegex = null
			let pathParameters = []

			if (entry.method) {
				methodRegex = methodToRegex(entry.method)
			}
			if (entry.path) {
				[pathRegex, pathParameters] = pathToRegex(entry.path)
			}

			return {
				...entry,
				methodRegex,
				pathRegex,
				pathParameters,
			}
		})
		.sort((e1, e2) => {
			const l1 = e1.pathParameters.length
			const l2 = e2.pathParameters.length
			if (l1 > l2) {
				return -1
			}
			if (l1 < l2) {
				return 1
			}
			return 0
		})
}

export function createRequestRouter (routeMap)
{
	const entries = routeMapToEntries(routeMap)

	return function routeRequest (request)
	{
		let method = request.method
		let url = new URL(request.url, 'http://example.com')
		let path = url.pathname

		let matchingEntries = entries
			.filter(e => !e.methodRegex || e.methodRegex.test(method))
			.filter(e => !e.pathRegex || e.pathRegex.test(path))

		let matchingEntry = matchingEntries[0]
		if (!matchingEntry) {
			return null
		}

		let pathMatch = path.match(matchingEntry.pathRegex)
		let pathArgs = pathMatch.slice(1)

		let parameters = {}
		for (let [index, key] of matchingEntry.pathParameters.entries()) {
			parameters[key] = pathArgs[index]
		}

		let route = { method, path, parameters }

		return [matchingEntry.endpoint, route]
	}
}

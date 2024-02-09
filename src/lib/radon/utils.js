export function getMaxArgsIndexFromString(str) {
    let maxArgsIndex = 0
    if (str) {
        let match
        const regexp = /\\\d\\/g
        while ((match = regexp.exec(str)) !== null) {
            let argsIndex = parseInt(match[0][1]) + 1
            if (argsIndex > maxArgsIndex) maxArgsIndex = argsIndex
        }
    }
    return maxArgsIndex
}

export function isHexString(str) {
    return (
        !Number.isInteger(str)
            && str.startsWith("0x")
            && /^[a-fA-F0-9]+$/i.test(str.slice(2))
    );
}
  
export function isHexStringOfLength(str, max) {
    return (isHexString(str)
        && str.slice(2).length <= max * 2
    );
}

export function isWildcard(str) {
    return str.length == 3 && /\\\d\\/g.test(str)
}
 
export function parseURL(url) {
    if (url && typeof url === 'string' && url.indexOf("://") > -1) {
        const hostIndex = url.indexOf("://") + 3
        const schema = url.slice(0, hostIndex)
        let host = url.slice(hostIndex)
        let path = ""
        let query = ""
        const pathIndex = host.indexOf("/")
        if (pathIndex > -1) {
            path = host.slice(pathIndex + 1)
            host = host.slice(0, pathIndex)
            const queryIndex = path.indexOf("?")
            if (queryIndex > -1) {
                query = path.slice(queryIndex + 1)
                path = path.slice(0, queryIndex)
            }
        }
        return [schema, host, path, query];
    } else {
        throw new EvalError(`Invalid URL was provided: ${url}`)
    }
}

export function spliceWildcards(obj, argIndex, argValue, argsCount) {
    if (obj && typeof obj === "string") {
        const wildcard = `\\${argIndex}\\`
        obj = obj.replaceAll(wildcard, argValue)
        for (var j = argIndex + 1; j < argsCount; j++) {
            obj = obj.replaceAll(`\\${j}\\`, `\\${j - 1}\\`)
        }
    } else if (obj && Array.isArray(obj)) {
        obj = obj.map(value => typeof value === "string" || Array.isArray(value)
            ? spliceWildcards(value, argIndex, argValue, argsCount)
            : value
        )
    }
    return obj;
}

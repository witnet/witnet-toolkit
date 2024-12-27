var protoBuf = require("protobufjs")
var protoRoot = protoBuf.Root.fromJSON(require("../../../assets/witnet.proto.json"))
var RADRequest = protoRoot.lookupType("RADRequest")

export function encodeRequest(payload) {
  var errMsg = RADRequest.verify(payload)
  if (errMsg) {
    throw Error(errMsg);
  } else {
    var message = RADRequest.fromObject(payload);
    return RADRequest.encode(message).finish()
  }
}

export function getWildcardsCountFromString(str) {
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

export function replaceWildcards(obj, args) {
    if (args.length > 10) args = args.slice(0, 10);
    if (obj && typeof obj === "string") {
        for (let argIndex = 0; argIndex < args.length; argIndex ++) {
            const wildcard = `\\${argIndex}\\`
            obj = obj.replaceAll(wildcard, args[argIndex])
        }
    } else if (obj && Array.isArray(obj)) {
        obj = obj.map(value => typeof value === "string" || Array.isArray(value)
            ? replaceWildcards(value, args)
            : value
        )
    }
    return obj;
}

export function spliceWildcard(obj, argIndex, argValue, argsCount) {
    if (obj && typeof obj === "string") {
        const wildcard = `\\${argIndex}\\`
        obj = obj.replaceAll(wildcard, argValue)
        for (var j = argIndex + 1; j < argsCount; j++) {
            obj = obj.replaceAll(`\\${j}\\`, `\\${j - 1}\\`)
        }
    } else if (obj && Array.isArray(obj)) {
        obj = obj.map(value => typeof value === "string" || Array.isArray(value)
            ? spliceWildcard(value, argIndex, argValue, argsCount)
            : value
        )
    }
    return obj;
}

export function toUpperCamelCase(str) {
    return str.replace(/\b(\w)/g, function(match, capture) {
        return capture.toUpperCase();
      }).replace(/\s+/g, '');
}

export function toUtf8Array(str) {
    var utf8 = [];
    for (var i=0; i < str.length; i++) {
        var charcode = str.charCodeAt(i);
        if (charcode < 0x80) utf8.push(charcode);
        else if (charcode < 0x800) {
            utf8.push(0xc0 | (charcode >> 6), 
                      0x80 | (charcode & 0x3f));
        }
        else if (charcode < 0xd800 || charcode >= 0xe000) {
            utf8.push(0xe0 | (charcode >> 12), 
                      0x80 | ((charcode>>6) & 0x3f), 
                      0x80 | (charcode & 0x3f));
        }
        // surrogate pair
        else {
            i++;
            // UTF-16 encodes 0x10000-0x10FFFF by
            // subtracting 0x10000 and splitting the
            // 20 bits of 0x0-0xFFFFF into two halves
            charcode = 0x10000 + (((charcode & 0x3ff)<<10)
                      | (str.charCodeAt(i) & 0x3ff));
            utf8.push(0xf0 | (charcode >>18), 
                      0x80 | ((charcode>>12) & 0x3f), 
                      0x80 | ((charcode>>6) & 0x3f), 
                      0x80 | (charcode & 0x3f));
        }
    }
    return utf8;
}

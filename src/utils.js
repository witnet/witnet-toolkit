const { execSync } = require("child_process")

module.exports = {
  countLeaves,
  dictionary,
  findKeyInObject,
  fromAscii,
  getMaxArgsIndexFromString,
  isHexString,
  isHexStringOfLength,
  isWildcard,
  mapObjectRecursively,
  padLeft,
  parseURL,
  spliceWildcards,
  splitSelectionFromProcessArgv,

  dryRunBytecode,
  dryRunBytecodeVerbose,
  getRequestMethodString,
  getRequestResultDataTypeString,
}

function dictionary(t, dict) {
  return new Proxy(dict, proxyHandler(t));
}

function countLeaves(t, obj) {
  if (!obj) {
      return 0;
  }
  else if (obj instanceof t) {
      return 1;
  }
  else if (Array.isArray(obj)) {
      return obj.map(function (item) { return countLeaves(t, item); }).reduce(function (a, b) { return a + b; }, 0);
  }
  else {
      return Object.values(obj).map(function (item) { return countLeaves(t, item); }).reduce(function (a, b) { return a + b; }, 0);
  }
}

async function dryRunBytecode(bytecode) {
  return (await execSync(`npx witnet-toolkit try-data-request --hex ${bytecode}`)).toString()
}

async function dryRunBytecodeVerbose(bytecode) {
  return (await execSync(`npx witnet-toolkit try-query --hex ${bytecode}`)).toString()
}

function findKeyInObject(dict, tag) {
  for (const key in dict) {
    if (typeof dict[key] === 'object') {
      if (key === tag) {
        return dict[key]
      } else {
        let found = findKeyInObject(dict[key], tag)
        if (found) return found
      }
    }
  }
}

function fromAscii(str) {
  const arr1 = []
  for (let n = 0, l = str.length; n < l; n++) {
    const hex = Number(str.charCodeAt(n)).toString(16)
    arr1.push(hex)
  }
  return "0x" + arr1.join("")
}

function getMaxArgsIndexFromString(str) {
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

function getRequestMethodString(method) {
  if (method == 0) {
    return "UNKNOWN"
  } else if (method == 1 || !method) {
    return "HTTP-GET"
  } else if (method == 2) {
    return "RNG"
  } else if (method == 3) {
    return "HTTP-POST"
  } else if (method == 4) {
    return "HTTP-HEAD"
  } else {
    return method.toString()
  }
}

function getRequestResultDataTypeString(type) {
  if (type == 1) {
    return "Array"
  } else if (type == 2) {
    return "Bool"
  } else if (type == 3) {
    return "Bytes"
  } else if (type == 4) {
    return "Integer"
  } else if (type == 5) {
    return "Float"
  } else if (type == 6) {
    return "Map"
  } else if (type == 7) {
    return "String"
  } else {
    return "(Undetermined)"
  }
}

function isHexString(str) {
  return (
    !Number.isInteger(str)
    && str.startsWith("0x")
    && /^[a-fA-F0-9]+$/i.test(str.slice(2))
  );
}

function isHexStringOfLength(str, max) {
  return (isHexString(str)
    && str.slice(2).length <= max * 2
  );
}

function isWildcard(str) {
  return str.length == 3 && /\\\d\\/g.test(str)
}

function mapObjectRecursively(obj, callback) {
  let newObj = {}
  for (let key in obj) {
    if (obj.hasOwnProperty(key)) {
      if (typeof obj[key] === "object") {
        newObj[key] = mapObjectRecursively(obj[key], callback);
      } else {
        newObj[key] = callback(key, obj[key]);
      }
    }
  }
  return newObj;
}

function padLeft(str, char, size) {
  if (str.length < size) {
    return char.repeat((size - str.length) / char.length) + str
  } else {
    return str
  }
}

function parseURL(url) {
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

function proxyHandler(t) {
  return {
      get: function (target, prop) {
          var _a;
          var found = (_a = target[prop]) !== null && _a !== void 0 ? _a : findKeyInObject(target, prop);
          if (!found) {
              throw EvalError("\u001B[1;31m['".concat(prop, "']\u001B[1;33m was not found in dictionary\u001B[0m"));
          }
          else if (!(found instanceof t)) {
              throw EvalError("\u001B[1;31m['".concat(prop, "']\u001B[1;33m was found with unexpected type!\u001B[0m"));
          }
          return found;
      }
  };
}

function spliceWildcards(obj, argIndex, argValue, argsCount) {
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

function splitSelectionFromProcessArgv(operand) {
  let selection = []
  if (process.argv.includes(operand)) {
    process.argv.map((argv, index, args) => {
      if (argv === operand) {
        if (index < process.argv.length - 1 && !args[index + 1].startsWith("--")) {
          selection = args[index + 1].replaceAll(":", ".").split(",")
        }
      }
    })
  }
  return selection
}

// function stringifyWitnetRequestMethod(method) {
//   switch (method) {
//     case Witnet.retrievals.Methods.HttpGet: return "HTTP-GET";
//     case Witnet.retrievals.Methods.HttpHead: return "HTTP-HEAD";
//     case Witnet.retrievals.Methods.HttpPost: return "HTTP-POST";
//     case Witnet.retrievals.Methods.RNG: return "WITNET-RNG";
//     default: return "UNKNOWN"
//   }
// }

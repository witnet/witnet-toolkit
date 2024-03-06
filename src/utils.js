const { execSync } = require("child_process")

module.exports = {
  dryRunBytecode,
  dryRunBytecodeVerbose,
  fromAscii,
  getRequestMethodString,
  getRequestResultDataTypeString,
  getMaxArgsIndexFromString,
  isHexString,
  isHexStringOfLength,
  isWildcard,
  mapObjectRecursively,
  padLeft,
  parseURL,
  spliceWildcards,
  splitSelectionFromProcessArgv,
}

async function dryRunBytecode(bytecode) {
  return (await execSync(`npx witnet-toolkit try-query --hex ${bytecode}`)).toString()
}

async function dryRunBytecodeVerbose(bytecode) {
  return (await execSync(`npx witnet-toolkit trace-query --hex ${bytecode}`)).toString()
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
  if (!method) {
    return "HTTP-GET";
  } else {
    const methodNameMap = {
      0: "UNKNOWN",
      1: "HTTP-GET",
      2: "RNG",
      3: "HTTP-POST",
      4: "HTTP-HEAD",
    };
    return methodNameMap[method] || method.toString();
  }
}

function getRequestResultDataTypeString(type) {
  const typeMap = {
    1: "Array",
    2: "Bool",
    3: "Bytes",
    4: "Integer",
    5: "Float",
    6: "Map",
    7: "String",
  };
  return typeMap[type] || "(Undetermined)";
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


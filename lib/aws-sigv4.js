'use strict'

const aws = require('aws-sdk')
const URL = require('url').URL

const PLUGIN_NAME = 'aws-sigv4'

const messages = {
  pluginConfigRequired: `The ${PLUGIN_NAME} plugin requires configuration under [script].config.plugins.${PLUGIN_NAME}.`,
  pluginParamServiceNameRequired: 'The "serviceName" parameter is required.',
  pluginParamServiceNameMustBeString: 'The "serviceName" parameter must have a string value.',
  sdkConfigInvalidError: `artillery-plugin-${PLUGIN_NAME} ERROR (signature will not be added): `
}

const impl = {
  // Check to see if the script contains a valid configuration.
  validateScriptConfig: function (scriptConfig) {
    // Validate that plugin config exists
    if (!(scriptConfig && scriptConfig.plugins && scriptConfig.plugins[PLUGIN_NAME])) {
      throw new Error(messages.pluginConfigRequired)
    }

    // Validate serviceName in config
    const serviceNameConfig = scriptConfig.plugins[PLUGIN_NAME].serviceName
    if (!serviceNameConfig) {
      throw new Error(messages.pluginParamServiceNameRequired)
    } else if (!(typeof serviceNameConfig !== 'string' || (serviceNameConfig instanceof String))) {
      throw new Error(messages.pluginParamServiceNameMustBeString)
    }
  },

  // Check to see if the AWS SDK configuration are valid.
  // Returns true if config is valid, false otherwise.
  validateSdkConfig: function (credentials, region) {
    // Some credentials must be found.
    if (!credentials) {
      console.log(`${messages.sdkConfigInvalidError} credentials not obtained.`)
      console.log('Ensure the aws-sdk can obtain valid credentials.')
      return false
    }

    // Check that the credentials contain either an access id and key pair or a Role ARN.
    const validIdAndKeyPair = (credentials.accessKeyId && credentials.secretAccessKey)
    if (!(validIdAndKeyPair || credentials.roleArn)) {
      console.log(`${messages.sdkConfigInvalidError} valid credentials not loaded.`)
      console.log('Ensure the aws-sdk can obtain credentials with either both accessKeyId and secretAccessKey attributes (optionally sessionToken) or a roleArn attribute.')
      return false
    }

    // A valid AWS region must be configured.
    if (!region) {
      console.log(`${messages.sdkConfigInvalidError} valid region not configured.`)
      console.log('Ensure the aws-sdk can obtain a valid region for use in signing your requests.')
      console.log('Consider exporting or setting AWS_REGION or alternatively specify a default region in your AWS config file.')
      return false
    }

    return true
  },

  // Adds an Amazon V4 signature to the Artillery requests.
  addAmazonSignatureV4: function (awsOptions, requestParams, context, ee, callback) {
    const url = requestParams.uri || requestParams.url

    // Perform variable substitution in url.
    const varNames = Object.getOwnPropertyNames(context.vars)
    const actualUrl = varNames.reduce((accUrl, name) => {
      return accUrl.split(`{{${name}}}`).join(context.vars[name])
    }, url.split(' ').join(''))

    // Get URL info needed to re-write the request.
    const targetUrl = new URL(actualUrl)
    const endpoint = new aws.Endpoint(targetUrl.href)
    const request = new aws.HttpRequest(endpoint)

    // Copy Artillery request parameters into the AWS HttpRequest.
    request.method = requestParams.method
    request.path = targetUrl.pathname + targetUrl.search
    request.region = awsOptions.region
    request.headers.Host = endpoint.host

    // Copy Artillery request headers into the AWS HttpRequest.
    for (var header in requestParams.headers) {
      request.headers[header] = requestParams.headers[header]
    }

    // If Artillery request contains a body then copy it.
    if (requestParams.body) {
      request.body = requestParams.body
    }

    // If Artillery request includes json in the body,
    //   then stringify and copy it into the AWS HttpRequest.
    if (requestParams.json) {
      request.body = JSON.stringify(requestParams.json)
    }

    // Now with all the request parameters copied to the AWS HttpRequest,
    //  we can use their signer to generate the Authorization header.
    const signer = new aws.Signers.V4(request, awsOptions.serviceName)
    signer.addAuthorization(awsOptions.credentials, new Date())

    // Copy the headers from the AWS HttpRequest back to the Artillery requestParams.
    //  This will now include the necessary Authorization header needed for AWS.
    for (header in request.headers) {
      requestParams.headers[header] = request.headers[header]
    }

    // Allow Artillery to continue.
    callback()
  }
}

// Implement plugin to be consumed by Artillery.
const AwsSigV4Plugin = function (scriptConfig, eventEmitter) {
  // Collect configuration from the environment and validate.
  const credentials = aws.config.credentials
  const region = aws.config.region
  const sdkConfigurationIsValid = impl.validateSdkConfig(credentials, region)

  if (!sdkConfigurationIsValid) {
    throw new Error('Invalid AWS SDK configuration: see messages above. Cannot create AwsSigV4Plugin.')
  }

  const serviceName = scriptConfig.plugins[PLUGIN_NAME].serviceName
  var sdkCredentials = false
  var sdkCredentialsError
  var p

  // impl.validateScriptConfig(scriptConfig)
  // serviceName = scriptConfig.plugins[PLUGIN_NAME].serviceName
  aws.config.getCredentials(function (err) {
    if (err) {
      sdkCredentialsError = err
    } else {
      sdkCredentials = true
      if (p) {
        impl.addAmazonSignatureV4(serviceName, p.requestParams, p.context, p.ee, p.callback)
      }
    }
  })

  if (!scriptConfig.processor) {
    scriptConfig.processor = {}
  }

  scriptConfig.processor.addAmazonSignatureV4 = function (requestParams, context, ee, callback) {
    if (!sdkCredentials) {
      if (sdkCredentialsError) {
        console.log([
          messages.sdkConfigInvalidError,
          'credentials fetch error.  ',
          'Ensure the aws-sdk can obtain valid credentials.  ',
          'Error: ',
          sdkCredentialsError.message
        ].join(''))
      } else {
        p = {
          requestParams: requestParams,
          context: context,
          ee: ee,
          callback: callback
        }
      }
    } else {
      impl.addAmazonSignatureV4({ serviceName, region, credentials }, requestParams, context, ee, callback)
    }
  }
}

// Provide init() function to return the plugin.
const init = function (scriptConfig, eventEmitter) {
  return new AwsSigV4Plugin(scriptConfig, eventEmitter)
}

module.exports = init

/* test-code */
module.exports.messages = messages
module.exports.impl = impl
/* end-test-code */

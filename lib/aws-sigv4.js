'use strict';

var aws = require('aws-sdk'),
    url = require('url'),
    template = require('artillery/util').template,
    constants = {
        PLUGIN_PREFIX: 'artillery-plugin-',
        PLUGIN_NAME: 'aws-sigv4',
        PLUGIN_PARAM_SERVICE_NAME: 'serviceName',
        THE: 'The "',
        CONFIG_REQUIRED: '" plugin requires configuration under [script].config.plugins.',
        PARAM_REQUIRED: '" parameter is required',
        PARAM_MUST_BE_STRING: '" param must have a string value',
        HEADER_AUTHORIZATION: 'Authorization',
        ERROR: ' ERROR (signature will not be added): '
    },
    messages = {
        pluginConfigRequired: constants.THE + constants.PLUGIN_NAME + constants.CONFIG_REQUIRED + constants.PLUGIN_NAME,
        pluginParamServiceNameRequired: constants.THE + constants.PLUGIN_PARAM_SERVICE_NAME + constants.PARAM_REQUIRED,
        pluginParamServiceNameMustBeString: constants.THE + constants.PLUGIN_PARAM_SERVICE_NAME + constants.PARAM_MUST_BE_STRING,
        sdkConfigInvalidError: constants.PLUGIN_PREFIX + constants.PLUGIN_NAME + constants.ERROR
    },
    impl = {
        validateScriptConfig: function(scriptConfig) {
            // Validate that plugin config exists
            if (!(scriptConfig && scriptConfig.plugins && constants.PLUGIN_NAME in scriptConfig.plugins)) {
                throw new Error(messages.pluginConfigRequired);
            }
            // Validate NAMESPACE
            if (!(constants.PLUGIN_PARAM_SERVICE_NAME in scriptConfig.plugins[constants.PLUGIN_NAME])) {
                throw new Error(messages.pluginParamServiceNameRequired);
            } else if (!('string' === typeof scriptConfig.plugins[constants.PLUGIN_NAME][constants.PLUGIN_PARAM_SERVICE_NAME] ||
                scriptConfig.plugins[constants.PLUGIN_NAME][constants.PLUGIN_PARAM_SERVICE_NAME] instanceof String)) {
                throw new Error(messages.pluginParamServiceNameMustBeString);
            }
        },
        validateSdkConfig: function(credentials, region) {
            var result = false;
            if (!credentials) {
                console.log([
                    messages.sdkConfigInvalidError,
                    'credentials not obtained.  ',
                    'Ensure the aws-sdk can obtain valid credentials.'
                ].join(''));
            } else if (
                !(
                    (credentials.accessKeyId && credentials.secretAccessKey) ||
                    credentials.roleArn
                )
            ) {
                console.log([
                    messages.sdkConfigInvalidError,
                    'valid credentials not loaded.  ',
                    'Ensure the aws-sdk can obtain credentials with either both accessKeyId and ',
                    'secretAccessKey attributes (optionally sessionToken) or a roleArn attribute.'
                ].join(''));
            } else if (!region) {
                console.log([
                    messages.sdkConfigInvalidError,
                    'valid region not configured.  ',
                    'Ensure the aws-sdk can obtain a valid region for use in signing your requests.  ',
                    'Consider exporting or setting AWS_REGION.  Alternatively specify a default ',
                    'region in your ~/.aws/config file.'
                ].join(''));
            } else {
                result = true;
            }
            return result;
        },
        addAmazonSignatureV4: function(scriptConfig, serviceName, requestParams, context, ee, callback) {
            var targetUrl = url.parse(maybePrependBase(template(requestParams.uri || requestParams.url, context), scriptConfig)),
                credentials = aws.config.credentials,
                region = aws.config.region,
                end = new aws.Endpoint(targetUrl.hostname),
                req = new aws.HttpRequest(end),
                signer,
                header;

            if (impl.validateSdkConfig(credentials, region)) {
                req.method = requestParams.method;
                req.path = targetUrl.path;
                req.region = region;
                req.headers.Host = end.host;

                for (header in requestParams.headers) {
                    req.headers[header] = template(requestParams.headers[header], context);
                }

                if (requestParams.json) {
                    req.body = JSON.stringify(template(requestParams.json, context));
                } else if (requestParams.body) {
                    requestParams.body = template(requestParams.body, context);
                }

                signer = new aws.Signers.V4(req, serviceName);
                signer.addAuthorization(credentials, new Date());

                for (header in req.headers) {
                    requestParams.headers[header] = req.headers[header];
                }
            }
            callback();
        }
    },
    api = {
        init: function(scriptConfig, eventEmitter) {
            var AwsSigV4Plugin = function(scriptConfig, eventEmitter) {
                var serviceName,
                    sdkCredentials = false,
                    sdkCredentialsError,
                    p;
                impl.validateScriptConfig(scriptConfig);
                serviceName = scriptConfig.plugins[constants.PLUGIN_NAME][constants.PLUGIN_PARAM_SERVICE_NAME];
                aws.config.getCredentials(function(err) {
                    if (err) {
                        sdkCredentialsError = err;
                    } else {
                        sdkCredentials = true;
                        if (p) {
                            impl.addAmazonSignatureV4(scriptConfig, serviceName, p.requestParams, p.context, p.ee, p.callback);
                        }
                    }
                });
                if (!scriptConfig.processor) {
                    scriptConfig.processor = {};
                }
                scriptConfig.processor.addAmazonSignatureV4 = function(requestParams, context, ee, callback) {
                    if (!sdkCredentials) {
                        if (sdkCredentialsError) {
                            console.log([
                                messages.sdkConfigInvalidError,
                                'credentials fetch error.  ',
                                'Ensure the aws-sdk can obtain valid credentials.  ',
                                'Error: ',
                                sdkCredentialsError.message
                            ].join(''));
                        } else {
                            p = { requestParams: requestParams, context: context, ee: ee, callback: callback };
                        }
                    } else {
                        impl.addAmazonSignatureV4(scriptConfig, serviceName, requestParams, context, ee, callback);
                    }
                };
            };
            return new AwsSigV4Plugin(scriptConfig, eventEmitter);
        }
    };

    function maybePrependBase(uri, config) {
        if (uri.startsWith('/')) {
            return config.target + uri;
        } else {
            return uri;
        }
    }

module.exports = api.init;

/* test-code */
module.exports.constants = constants;
module.exports.messages = messages;
module.exports.impl = impl;
module.exports.api = api;
/* end-test-code */

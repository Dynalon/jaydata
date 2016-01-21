import $data, { $C, Guard, Container, Exception, MemberDefinition } from 'jaydata-core';


/* data js patch to support window messaging */
/* will be implemented as customHttpClient in next version */
(function ($data, undefined) {
    var odata = $data.__global.OData;

    odata.originalHttpClient = odata.defaultHttpClient;
    $data.postMessageODataHandler = {
        postMessageHttpClient: {
            targetIframe: undefined,
            request: function (request, success, error) {
                var targetIframe = request.targetIframe || $data.postMessageODataHandler.postMessageHttpClient.targetIframe;
                var targetOrigin = request.targetOrigin || $data.postMessageODataHandler.postMessageHttpClient.targetOrigin || '*';

                if (targetIframe) {
                    var listener = function (event) {
                        $data.Trace.log('in listener');
                        $data.__global.removeEventListener('message', listener);
                        var statusCode = event.data.statusCode;
                        if (statusCode >= 200 && statusCode <= 299) {
                            success(event.data);
                        } else {
                            error(event.data);
                        }
                    };
                    $data.__global.addEventListener('message', listener, false);
                    $data.Trace.log('before post', targetIframe);
                    targetIframe.postMessage(request, targetOrigin);
                } else {
                    return odata.originalHttpClient.request(request, success, error);
                }
            }
        },
        requestProxy: function (request, success, error) {
            success = request.success || success;
            error = request.error || error;

            delete request.success;
            delete request.error;

            var targetIframe = request.targetIframe || $data.postMessageODataHandler.postMessageHttpClient.targetIframe;
            var targetOrigin = request.targetOrigin || $data.postMessageODataHandler.postMessageHttpClient.targetOrigin || '*';


            if (targetIframe) {
                request.requestProxy = true;
                var listener = function (event) {
                    $data.Trace.log('in listener');
                    $data.__global.removeEventListener('message', listener);
                    var statusCode = event.data.statusCode;
                    if (statusCode >= 200 && statusCode <= 299) {
                        success(event.data);
                    } else {
                        error(event.data);
                    }
                };
                $data.__global.addEventListener('message', listener, false);
                $data.Trace.log('before post', targetIframe);
                targetIframe.postMessage(request, targetOrigin);
            } else {
                error({ message: "No iframe detected", request: request, response: undefined });
            }
        }
    };
    odata.defaultHttpClient = $data.postMessageODataHandler.postMessageHttpClient;

})($data);

(function ($data) {
    $data.MsCrm = {
        disableBatch: true
    };
    $data.MsCrm.Auth = {
        trace: true,
        clientAuthorizationPath: "/WebResources/new_authorize.html",
        messageHandlerPath: "/WebResources/new_postmessage.html",
        login: function do_login(crmUrl, cb, local) {
            var iframe;

            var onMessagehandlerLoaded = function (e) {
                if ($data.MsCrm.Auth.trace) $data.Trace.log("Message received", crmUrl);
                if (e.data.MessageHandlerLoaded) {
                    if ($data.MsCrm.Auth.trace) $data.Trace.log("Message handler loaded", crmUrl);
                    $data.__global.removeEventListener("message", onMessagehandlerLoaded);
                    $data.__global.OData.defaultHttpClient.targetIframe = iframe.contentWindow;
                    cb(iframe.contentWindow, crmUrl);
                }
            }

            var onAuthenticated = function (e) {
                iframe = document.createElement("iframe");
                if (e.data.Authenticated) {
                    $data.Trace.log("Logged in to CRM: " + crmUrl);
                    $data.__global.removeEventListener("message", onAuthenticated);
                    $data.__global.addEventListener("message", onMessagehandlerLoaded);
                    var url = local ? "postmessage.html" : crmUrl + $data.MsCrm.Auth.messageHandlerPath;
                    iframe.src = url;
                    iframe.style.display = "none";
                    document.body.appendChild(iframe);
                }
            }
            $data.__global.addEventListener("message", onAuthenticated);
            var url = local ? "authorize.html" : crmUrl + $data.MsCrm.Auth.clientAuthorizationPath;
            url = url;
            var w = $data.__global.open(url, "_blank", "resizable=false,location=0,menubar=0,toolbar=0,width=400,height=600");
        }

    }
    $data.MsCrm.init = function (crmAddress, contextType, cb) {
        var config = {};
        if (typeof crmAddress === 'object' && crmAddress) {
            config = crmAddress;
            crmAddress = config.url;
            delete config.url;
        }
        var serviceUrl = crmAddress + '/XRMServices/2011/OrganizationData.svc';

        if ($data.__global.location.href.indexOf(crmAddress) > -1) {
            initContext();
        } else {
            $data.MsCrm.Auth.login(crmAddress, function () {
                initContext();
            });
        }

        function initContext() {
            if (!(contextType.isAssignableTo && contextType.isAssignableTo($data.EntityContext))) {
                cb = contextType;
                config.disableBatch = $data.MsCrm.disableBatch;
                $data.service(serviceUrl, config, function (factory) {
                    var ctx = factory();
                    ctx.onReady().then(function () {
                        cb(ctx, factory);
                    });
                });
            } else {
                function factory() {
                    return new contextType({ name: 'oData', oDataServiceHost: serviceUrl, disableBatch: $data.MsCrm.disableBatch });
                }
                var ctx = factory();
                ctx.onReady().then(function () {
                    cb(ctx, factory);
                });
            }
        }
    }

})($data);

export default $data

const CUSTOM_DOMAIN = "dcproxy.caplouge.workers.dev";

var routes = {};
routes["docker." + CUSTOM_DOMAIN] = "https://registry-1.docker.io";
routes[CUSTOM_DOMAIN] = "https://registry-1.docker.io";
routes["quay." + CUSTOM_DOMAIN] = "https://quay.io";
routes["gcr." + CUSTOM_DOMAIN] = "https://gcr.io";
routes["k8s-gcr." + CUSTOM_DOMAIN] = "https://k8s.gcr.io";
routes["k8s." + CUSTOM_DOMAIN] = "https://registry.k8s.io";
routes["ghcr." + CUSTOM_DOMAIN] = "https://ghcr.io";
routes["cloudsmith." + CUSTOM_DOMAIN] = "https://docker.cloudsmith.io";
routes["ecr." + CUSTOM_DOMAIN] = "https://public.ecr.aws";
routes["docker-staging." + CUSTOM_DOMAIN] = "https://registry-1.docker.io";

function responseUnauthorized(url) {
  return new Response(JSON.stringify({ message: "UNAUTHORIZED" }), {
    status: 401,
    headers: {
      "Www-Authenticate": 'Bearer realm="https://' + url.hostname + '/v2/auth",service="cloudflare-docker-proxy"',
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

function getUpstream(hostname) {
  if (hostname in routes) return routes[hostname];
  return "";
}

async function handleRequest(request, hostname) {
  var url = new URL(request.url);

  if (url.pathname == "/") {
    return Response.redirect(url.protocol + "//" + url.host + "/v2/", 301);
  }

  var upstream = getUpstream(hostname);
  if (upstream == "") {
    return new Response(JSON.stringify({ routes: routes }), { status: 404 });
  }

  var isDockerHub = (upstream == "https://registry-1.docker.io");
  var authorization = request.headers.get("Authorization");

  // === /v2/ - Registry API root ===
  // Docker Hub /v2/ returns 307 to auth.docker.io/token.
  // We return 401 immediately with our own realm, NO upstream fetch needed.
  if (url.pathname == "/v2/") {
    if (isDockerHub) {
      return responseUnauthorized(url);
    }
    try {
      var h = {};
      if (authorization) h["Authorization"] = authorization;
      var resp = await fetch(upstream + "/v2/", {
        method: "GET",
        headers: new Headers(h),
        redirect: "follow",
        signal: AbortSignal.timeout(10000)
      });
      if (resp.status === 401) {
        return responseUnauthorized(url);
      }
      return resp;
    } catch (e) {
      return responseUnauthorized(url);
    }
  }

  // === /v2/auth - Token endpoint ===
  if (url.pathname == "/v2/auth") {
    var scope = url.searchParams.get("scope");
    var service = url.searchParams.get("service");

    if (!service && isDockerHub) {
      service = "registry.docker.io";
    }

    // Fix scope: "repository:postgres:pull" -> "repository:library/postgres:pull"
    if (scope && isDockerHub) {
      var parts = scope.split(":");
      if (parts.length == 3 && parts[1].indexOf("/") == -1) {
        parts[1] = "library/" + parts[1];
        scope = parts.join(":");
      }
    }

    if (isDockerHub) {
      var tokenUrl = new URL("https://auth.docker.io/token");
      if (service) tokenUrl.searchParams.set("service", service);
      if (scope) tokenUrl.searchParams.set("scope", scope);

      try {
        var authHeaders = {};
        if (authorization) authHeaders["Authorization"] = authorization;
        var tokenResp = await fetch(tokenUrl.toString(), {
          method: "GET",
          headers: new Headers(authHeaders),
          redirect: "follow",
          signal: AbortSignal.timeout(10000)
        });
        return new Response(tokenResp.body, {
          status: tokenResp.status,
          headers: tokenResp.headers
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 502,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    return responseUnauthorized(url);
  }

  // === Other paths - proxy to upstream ===
  var newUrl = new URL(upstream + url.pathname);
  var newReq = new Request(newUrl, {
    method: request.method,
    headers: request.headers,
    redirect: isDockerHub ? "manual" : "follow"
  });

  try {
    var pullResp = await fetch(newReq, { signal: AbortSignal.timeout(30000) });
    if (pullResp.status == 401) {
      return responseUnauthorized(url);
    }
    if (isDockerHub && pullResp.status == 307) {
      var location = pullResp.headers.get("Location");
      if (location) {
        var redirectResp = await fetch(location, {
          method: "GET",
          redirect: "follow",
          signal: AbortSignal.timeout(30000)
        });
        return new Response(redirectResp.body, {
          status: redirectResp.status,
          headers: redirectResp.headers
        });
      }
    }
    return pullResp;
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 502,
      headers: { "Content-Type": "application/json" }
    });
  }
}

addEventListener("fetch", function(event) {
  event.passThroughOnException();
  var u = new URL(event.request.url);
  event.respondWith(handleRequest(event.request, u.hostname));
});

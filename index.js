/*
CORS Anywhere as a Cloudflare Worker!
(c) 2019 by Zibri (www.zibri.org)
email: zibri AT zibri DOT org
https://github.com/Zibri/cloudflare-cors-anywhere

This Cloudflare Worker script acts as a CORS proxy that allows
cross-origin resource sharing for specified origins and URLs.
It handles OPTIONS preflight requests and modifies response headers accordingly to enable CORS.
The script also includes functionality to parse custom headers and provide detailed information
about the CORS proxy service when accessed without specific parameters.
The script is configurable with whitelist and blacklist patterns, although the blacklist feature is currently unused.
The main goal is to facilitate cross-origin requests while enforcing specific security and rate-limiting policies.
*/

// Configuration: Whitelist and Blacklist (not used in this version)
// whitelist = [ "^http.?://www.zibri.org$", "zibri.org$", "test\\..*" ];  // regexp for whitelisted urls
const blacklistUrls = []; // regexp for blacklisted urls
const whitelistOrigins = [".*"]; // regexp for whitelisted origins

// Main event listener
addEventListener("fetch", async event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const originUrl = new URL(request.url);
  const targetUrl = decodeURIComponent(
    decodeURIComponent(originUrl.search.substr(1))
  );

  if (!targetUrl) {
    return new Response(
      "CLOUDFLARE-CORS-ANYWHERE\n\n" +
        "Source:\nhttps://github.com/Zibri/cloudflare-cors-anywhere\n\n" +
        "Usage:\n" +
        originUrl.origin +
        "/?uri\n\n" +
        "Donate:\nhttps://paypal.me/Zibri/5\n\n" +
        "Limits: 100,000 requests/day\n" +
        "          1,000 requests/10 minutes\n\n",
      { status: 200, headers: { "Content-Type": "text/plain" } }
    );
  }

  const originHeader = request.headers.get("Origin");

  if (
    !isListed(targetUrl, blacklistUrls) &&
    isListed(originHeader, whitelistOrigins)
  ) {
    if (request.method === "OPTIONS") {
      // Handle preflight request
      return handlePreflight(request);
    } else {
      // Handle actual request
      const modifiedRequest = await createModifiedRequest(request, targetUrl);
      const response = await fetch(modifiedRequest);
      return createModifiedResponse(response, originHeader);
    }
  } else {
    return new Response(
      "Create your own CORS proxy</br>\n" +
        "<a href='https://github.com/Zibri/cloudflare-cors-anywhere'>https://github.com/Zibri/cloudflare-cors-anywhere</a></br>\n" +
        "\nDonate</br>\n" +
        "<a href='https://paypal.me/Zibri/5'>https://paypal.me/Zibri/5</a>\n",
      {
        status: 403,
        statusText: "Forbidden",
        headers: { "Content-Type": "text/html" }
      }
    );
  }
}

async function createModifiedRequest(originalRequest, targetUrl) {
  const headers = new Headers(originalRequest.headers);

  // Remove headers that shouldn't be proxied
  [
    "host",
    "origin",
    "referer",
    "cf-connecting-ip",
    "cf-ipcountry",
    "x-forwarded-for"
  ].forEach(header => {
    headers.delete(header);
  });

  let body = null;
  if (["POST", "PUT", "PATCH"].includes(originalRequest.method)) {
    // For methods that can have a body, read it into memory
    body = await originalRequest.arrayBuffer();
  }

  return new Request(targetUrl, {
    method: originalRequest.method,
    headers: headers,
    body: body,
    redirect: "follow"
  });
}

function handlePreflight(request) {
  const headers = new Headers({
    "Access-Control-Allow-Origin": request.headers.get("Origin") || "*",
    "Access-Control-Allow-Methods":
      request.headers.get("Access-Control-Request-Method") ||
      "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      request.headers.get("Access-Control-Request-Headers") || "",
    "Access-Control-Max-Age": "86400"
  });

  return new Response(null, { headers: headers });
}

function createModifiedResponse(originalResponse, origin) {
  const headers = new Headers(originalResponse.headers);
  headers.set("Access-Control-Allow-Origin", origin || "*");

  // Expose all response headers to the client
  const exposedHeaders = [...originalResponse.headers.keys()].join(", ");
  headers.set("Access-Control-Expose-Headers", exposedHeaders);

  return new Response(originalResponse.body, {
    status: originalResponse.status,
    statusText: originalResponse.statusText,
    headers: headers
  });
}

// Utility function to check if a given URI or origin is listed in the whitelist or blacklist
function isListed(uri, listing) {
  let isListed = false;
  if (typeof uri === "string") {
    listing.forEach(pattern => {
      if (uri.match(pattern) !== null) {
        isListed = true;
      }
    });
  } else {
    // When URI is null (e.g., when Origin header is missing), decide based on the implementation
    isListed = true; // true accepts null origins, false would reject them
  }
  return isListed;
}

const crypto = require("crypto");

exports.handler = async (event) => {
  const { email, expires, token } = event.queryStringParameters || {};

  if (!email || !expires || !token) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "text/html" },
      body: htmlPage("Invalid link", "This download link is malformed."),
    };
  }

  if (Date.now() > parseInt(expires, 10)) {
    return {
      statusCode: 410,
      headers: { "Content-Type": "text/html" },
      body: htmlPage(
        "Link expired",
        'This link has expired. <a href="/miniti">Request a new one</a>.'
      ),
    };
  }

  const secret = process.env.DOWNLOAD_SECRET;
  const data = `${email}:${expires}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("hex");

  if (token !== expected) {
    return {
      statusCode: 403,
      headers: { "Content-Type": "text/html" },
      body: htmlPage("Invalid link", "This download link is not valid."),
    };
  }

  return {
    statusCode: 302,
    headers: { Location: process.env.DOWNLOAD_URL },
  };
};

function htmlPage(title, message) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>body{font-family:-apple-system,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#0f1210;color:#CCCCCC;}
    .box{text-align:center;padding:40px;}a{color:#94F3A6;}</style></head>
    <body><div class="box"><h2>${title}</h2><p>${message}</p></div></body></html>`;
}

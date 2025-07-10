/**
 * Cloudflare Worker with Password Protection and Reverse Proxy.
 *
 * - Intercepts all incoming requests.
 * - Shows a password prompt for users without a valid session cookie.
 * - Validates submitted passwords against the `PASSWORD` environment variable.
 * - Sets a secure cookie using the `AUTH_SECRET` environment variable upon successful login.
 * - Proxies authenticated requests to the destination URL.
 */

export default {
  async fetch(request, env, ctx) {
    // The destination for your application, running through the Cloudflare Tunnel.
    const destinationURL = "https://andrea-gpt.ultralistic.com";

    // These must be set in your Worker's settings in the Cloudflare dashboard.
    // PASSWORD: The password users will enter.
    // AUTH_SECRET: A long, random string for securing the session cookie.
    const { PASSWORD, AUTH_SECRET } = env;

    if (!PASSWORD || !AUTH_SECRET) {
      return new Response("ERROR: Worker secrets not configured. Please set PASSWORD and AUTH_SECRET.", { status: 500 });
    }

    const cookie = request.headers.get('Cookie');
    const isAuthenticated = cookie && cookie.includes(`auth-token=${AUTH_SECRET}`);

    if (isAuthenticated) {
      // User is authenticated, proxy the request to the real application.
      return await proxyRequest(request, destinationURL);
    }

    // Handle login attempts.
    if (request.method === 'POST') {
      const formData = await request.formData();
      if (formData.get('password') === PASSWORD) {
        // Correct password. Set a secure cookie and redirect to the application.
        const response = new Response('Redirecting...', {
          status: 302,
          headers: {
            'Location': request.url,
            'Set-Cookie': `auth-token=${AUTH_SECRET}; Path=/; HttpOnly; Secure; SameSite=Strict`,
          },
        });
        return response;
      } else {
        // Incorrect password. Show login page again with an error message.
        return new Response(getLoginPage('Invalid password. Please try again.'), {
          status: 401,
          headers: { 'Content-Type': 'text/html' },
        });
      }
    }

    // If not authenticated and not a login attempt, show the login page.
    return new Response(getLoginPage(), {
      status: 401,
      headers: { 'Content-Type': 'text/html' },
    });
  }
};

/**
 * Proxies the incoming request to the destination URL.
 * @param {Request} request The original incoming request.
 * @param {string} destinationURL The URL to proxy to.
 * @returns {Promise<Response>}
 */
async function proxyRequest(request, destinationURL) {
    const url = new URL(request.url);
    const targetURL = destinationURL + url.pathname + url.search;
    
    // Create a new request to the target, keeping the original's properties.
    const newRequest = new Request(targetURL, request);
    
    // Set the Host header to match the destination, which is crucial for virtual hosting.
    newRequest.headers.set('Host', new URL(destinationURL).hostname);

    return fetch(newRequest);
}

/**
 * Generates the HTML for the login page.
 * @param {string | null} error An optional error message to display.
 * @returns {string} The HTML content.
 */
function getLoginPage(error = null) {
    const errorHtml = error ? `<p class="error">${error}</p>` : '';
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Authorization Required</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #f0f2f5;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            color: #333;
        }
        .login-container {
            background-color: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            text-align: center;
            width: 90%;
            max-width: 340px;
        }
        h1 {
            font-size: 24px;
            margin-top: 0;
            margin-bottom: 20px;
        }
        form {
            display: flex;
            flex-direction: column;
        }
        input[type="password"] {
            padding: 12px;
            margin-bottom: 20px;
            border: 1px solid #ccc;
            border-radius: 4px;
            font-size: 16px;
        }
        input[type="password"]:focus {
            border-color: #007bff;
            outline: none;
            box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
        }
        button {
            padding: 12px;
            border: none;
            border-radius: 4px;
            background-color: #007bff;
            color: white;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        button:hover {
            background-color: #0056b3;
        }
        .error {
            color: #d93025;
            margin-bottom: 15px;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <h1>Authorization Required</h1>
        ${errorHtml}
        <form method="POST">
            <input type="password" name="password" placeholder="Password" autofocus required>
            <button type="submit">Enter</button>
        </form>
    </div>
</body>
</html>`;
} 
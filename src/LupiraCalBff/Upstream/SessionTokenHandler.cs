using System.Net.Http.Headers;
using Duende.AccessTokenManagement;
using Duende.AccessTokenManagement.OpenIdConnect;

namespace LupiraCalBff.Upstream;

/// <summary>
/// Attaches the caller's credential to an upstream call, the same way the YARP transform does for a
/// proxied route — that transform only runs on proxy routes, so a handler would otherwise call
/// upstream unauthenticated.
/// </summary>
public sealed class SessionTokenHandler(IHttpContextAccessor accessor, IWebHostEnvironment environment)
    : DelegatingHandler
{
    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var context = accessor.HttpContext;
        if (context is null) return await base.SendAsync(request, cancellationToken);

        var incoming = context.Request.Headers.Authorization.ToString();
        if (incoming.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            // A native caller presented its own token; the upstreams validate it themselves.
            request.Headers.TryAddWithoutValidation("Authorization", incoming);
        }
        else if (environment.IsDevelopment())
        {
            var devUser = context.RequestServices.GetRequiredService<IConfiguration>()["Dev:User"] ?? "dev@localhost";
            request.Headers.Remove("X-Dev-User");
            request.Headers.TryAddWithoutValidation("X-Dev-User", devUser);
        }
        else if (context.User.Identity?.IsAuthenticated == true)
        {
            var token = await context.GetUserAccessTokenAsync().GetToken();
            var accessToken = token.AccessToken.ToString();
            if (!string.IsNullOrEmpty(accessToken))
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        }

        return await base.SendAsync(request, cancellationToken);
    }
}

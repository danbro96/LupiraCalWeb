using LupiraCalBff.Handlers;

namespace LupiraCalBff.Endpoints;

public static class ContactEndpoints
{
    public static IEndpointRouteBuilder MapContactEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/contacts/{id:guid}/context", ContactContextHandler.Handle)
            .WithName("GetContactContext")
            .WithTags("bff-contacts")
            .RequireAuthorization();

        return app;
    }
}

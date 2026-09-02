using System.Text.RegularExpressions;
using LupiraCalBff.OpenApi;
using LupiraCalBff.Proxy;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace LupiraCalBff.UnitTests;

/// <summary>
/// The route table is computed from <c>exposed.json</c> at startup: the allowlist and the published
/// document must agree, and the keys must be shaped the way YARP's <c>LoadFromConfig</c> and the
/// <c>ApiPrefixes</c> fence read them.
/// </summary>
public class ProxyRoutesTests
{
    private static readonly ExposedSurface Exposed = ExposedSurface.Load();

    /// <summary>Reads the generated keys back exactly as the app does.</summary>
    private static IConfigurationSection Routes() =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(ProxyRoutes.Build(Exposed))
            .Build()
            .GetSection("ReverseProxy:Routes");

    [Fact]
    public void Every_allowlisted_operation_is_routed_exactly_once()
    {
        var routed = Routes().GetChildren()
            .SelectMany(route => route.GetSection("Match:Methods").GetChildren()
                .Select(m => $"{m.Value} {route["Match:Path"]}"))
            .ToList();

        var declared = Exposed.Operations
            .SelectMany(g => g.Value.Select(op => Prefixed(g.Key, op)))
            .Concat(Exposed.Static.SelectMany(g => g.Value.Select(op => Prefixed(g.Key, op))))
            // Device ingest keeps the upstream's own path: no prefix, so nothing to prepend.
            .Concat(Exposed.Device.SelectMany(g => g.Value))
            .ToList();

        Assert.Equal(declared.Count, routed.Count);
        Assert.Empty(declared.Except(routed, StringComparer.Ordinal));
    }

    [Fact]
    public void Only_the_static_subtrees_are_wildcards()
    {
        var wildcards = Routes().GetChildren()
            .Select(route => route["Match:Path"]!)
            .Where(path => path.Contains("**", StringComparison.Ordinal))
            .ToList();

        var expected = Exposed.Static
            .SelectMany(g => g.Value.Select(op => Prefixed(g.Key, op).Split(' ', 2)[1]))
            .ToList();

        // Anything else forwards whatever the upstream adds under it, unreviewed.
        Assert.Equal(expected.Order(StringComparer.Ordinal), wildcards.Order(StringComparer.Ordinal));
    }

    [Fact]
    public void Member_routes_carry_the_default_policy_and_strip_their_prefix()
    {
        foreach (var route in Routes().GetChildren())
        {
            var path = route["Match:Path"]!;
            if (IsDevicePath(path)) continue;

            var prefix = ExposedSurface.ClusterPrefixes[route["ClusterId"]!];
            Assert.Equal("Default", route["AuthorizationPolicy"]);
            Assert.Equal(prefix, route["Transforms:0:PathRemovePrefix"]);
            Assert.StartsWith(prefix, path, StringComparison.Ordinal);
        }
    }

    [Fact]
    public void Device_ingest_is_anonymous_untransformed_and_unprefixed()
    {
        var device = Routes().GetChildren().Where(r => IsDevicePath(r["Match:Path"]!)).ToList();

        Assert.NotEmpty(device);
        foreach (var route in device)
        {
            // The credential is a per-device key only location-api can validate; the BFF gates on the
            // header's shape and the transform stands aside so it reaches the upstream untouched.
            Assert.Equal("Anonymous", route["AuthorizationPolicy"]);
            Assert.Null(route["Transforms:0:PathRemovePrefix"]);
            Assert.DoesNotContain(ExposedSurface.ClusterPrefixes[route["ClusterId"]!], route["Match:Path"]!);
        }
    }

    [Fact]
    public void Nothing_routes_a_surface_that_uses_a_different_credential()
    {
        // Anchored to the resource root, so a list owner's own /lists/{id}/shares stays fine. Device
        // ingest sits at /ingest/location with no cluster prefix, so it does not match either.
        var forbidden = new Regex(@"^/[a-z-]+/(pingz|ingest|shared|shares|users)(/|$)");

        var offending = Routes().GetChildren()
            .Select(r => r["Match:Path"]!)
            .Where(path => forbidden.IsMatch(path))
            .ToList();

        Assert.Empty(offending);
    }

    [Fact]
    public void Route_keys_are_unique()
    {
        var keys = Routes().GetChildren().Select(r => r.Key).ToList();

        Assert.Equal(keys.Count, keys.Distinct(StringComparer.Ordinal).Count());
    }

    [Fact]
    public void A_colliding_allowlist_throws_rather_than_dropping_a_route()
    {
        // The key is derived from cluster + path with punctuation flattened, so two paths could collide
        // and one would silently win.
        var colliding = new ExposedSurface
        {
            Operations = new()
            {
                ["cal-api"] = ["GET /items/{id}", "GET /items-id"],
            },
        };

        Assert.Throws<InvalidOperationException>(() => ProxyRoutes.Build(colliding).ToList());
    }

    private static string Prefixed(string cluster, string operation)
    {
        var parts = operation.Split(' ', 2);
        return $"{parts[0]} {ExposedSurface.ClusterPrefixes[cluster]}{parts[1]}";
    }

    private static bool IsDevicePath(string path) =>
        Exposed.Device.SelectMany(g => g.Value).Any(entry => entry.Split(' ', 2)[1] == path);
}

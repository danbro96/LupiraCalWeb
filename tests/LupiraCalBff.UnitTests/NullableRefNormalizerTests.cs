using System.Text.Json.Nodes;
using LupiraCalBff.OpenApi;
using Xunit;

namespace LupiraCalBff.UnitTests;

/// <summary>
/// The normalizer exists only to work around a generator bug (TODO(kiota)), so what matters is that it
/// touches nothing but the nullable-reference idiom — a real union collapsed by mistake would silently
/// change the generated client's types.
/// </summary>
public class NullableRefNormalizerTests
{
    [Fact]
    public void Collapses_the_nullable_reference_idiom_to_a_bare_ref()
    {
        var (document, collapsed) = Normalize("""
            { "components": { "schemas": { "Item": { "properties": {
                "status": { "oneOf": [{ "type": "null" }, { "$ref": "#/components/schemas/Status" }] } } } } } }
            """);

        Assert.Equal(1, collapsed);
        var status = document["components"]!["schemas"]!["Item"]!["properties"]!["status"]!;
        Assert.Equal("#/components/schemas/Status", status["$ref"]!.GetValue<string>());
        Assert.Null(status["oneOf"]);
    }

    [Fact]
    public void Keeps_a_sibling_description_the_branch_carried()
    {
        var (document, _) = Normalize("""
            { "schemas": { "s": { "description": "why", "oneOf": [
                { "type": "null" }, { "$ref": "#/x" }] } } }
            """);

        var s = document["schemas"]!["s"]!;
        Assert.Equal("why", s["description"]!.GetValue<string>());
        Assert.Equal("#/x", s["$ref"]!.GetValue<string>());
    }

    [Fact]
    public void Leaves_a_real_union_alone()
    {
        var (document, collapsed) = Normalize("""
            { "schemas": { "s": { "oneOf": [{ "$ref": "#/a" }, { "$ref": "#/b" }] } } }
            """);

        Assert.Equal(0, collapsed);
        Assert.NotNull(document["schemas"]!["s"]!["oneOf"]);
    }

    [Fact]
    public void Leaves_a_three_branch_union_alone_even_with_a_null()
    {
        var (_, collapsed) = Normalize("""
            { "schemas": { "s": { "oneOf": [
                { "type": "null" }, { "$ref": "#/a" }, { "$ref": "#/b" }] } } }
            """);

        Assert.Equal(0, collapsed);
    }

    [Fact]
    public void Does_not_mutate_its_input()
    {
        var source = JsonNode.Parse("""
            { "s": { "oneOf": [{ "type": "null" }, { "$ref": "#/a" }] } }
            """)!.AsObject();
        var before = source.ToJsonString();

        NullableRefNormalizer.Normalize(source);

        Assert.Equal(before, source.ToJsonString());
    }

    private static (JsonObject Document, int Collapsed) Normalize(string json) =>
        NullableRefNormalizer.Normalize(JsonNode.Parse(json)!.AsObject());
}

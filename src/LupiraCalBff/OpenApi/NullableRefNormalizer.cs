using System.Text.Json.Nodes;

namespace LupiraCalBff.OpenApi;

/// <summary>
/// Rewrites <c>oneOf: [{type: "null"}, {$ref: X}]</c> to a bare <c>{$ref: X}</c>, producing the
/// upstream specs the C# client generator reads.
/// </summary>
/// <remarks>
/// Kiota models every <c>oneOf</c> as a composed type, so the idiom yields a wrapper class plus a
/// junk member type per property — 39 of each in cal alone, and reads become
/// <c>item.Status?.ItemStatus</c>. Collapsed, it is simply <c>ItemStatus?</c>.
///
/// Deliberately NOT applied to the document the BFF publishes: orval uses the null branch and emits
/// <c>status?: null | ItemStatus</c>, so collapsing there would silently drop the null from the
/// TypeScript types.
/// </remarks>
/// TODO(kiota): drop this and generate from the unmodified specs once a kiota release carries the
/// oneOf-null fix (merged 2026-08-19, unreleased as of 1.34.1). The specs are correct — OpenAPI 3.1
/// has no other way to express a nullable reference.
/// https://github.com/microsoft/kiota/issues/6776 · https://github.com/microsoft/kiota/pull/8064
internal static class NullableRefNormalizer
{
    /// <summary>Returns the rewritten document and how many sites were collapsed.</summary>
    public static (JsonObject Document, int Collapsed) Normalize(JsonObject document)
    {
        var clone = (JsonObject)document.DeepClone();
        var collapsed = 0;
        Visit(clone, ref collapsed);
        return (clone, collapsed);
    }

    private static void Visit(JsonNode node, ref int collapsed)
    {
        switch (node)
        {
            case JsonObject obj:
                foreach (var (key, value) in obj.ToList())
                {
                    if (value is JsonObject child && Collapse(child) is { } replacement)
                    {
                        obj[key] = replacement;
                        collapsed++;
                        continue;
                    }

                    if (value is not null) Visit(value, ref collapsed);
                }

                break;
            case JsonArray array:
                for (var i = 0; i < array.Count; i++)
                {
                    if (array[i] is JsonObject child && Collapse(child) is { } replacement)
                    {
                        array[i] = replacement;
                        collapsed++;
                        continue;
                    }

                    if (array[i] is { } value) Visit(value, ref collapsed);
                }

                break;
        }
    }

    /// <summary>The collapsed schema, or null when this is not the nullable-reference idiom.</summary>
    private static JsonObject? Collapse(JsonObject candidate)
    {
        if (candidate["oneOf"] is not JsonArray branches || branches.Count != 2) return null;

        JsonObject? reference = null;
        var sawNull = false;
        foreach (var branch in branches.OfType<JsonObject>())
        {
            if (branch.Count == 1 && branch["type"]?.GetValue<string>() == "null") sawNull = true;
            else if (branch.ContainsKey("$ref")) reference = branch;
            else return null;
        }

        if (!sawNull || reference is null) return null;

        // 3.1 allows `$ref` siblings, so the branch's own `description` survives the collapse — and so
        // does anything the outer schema carried alongside `oneOf`.
        var collapsed = new JsonObject();
        foreach (var (key, value) in candidate.Where(kv => kv.Key != "oneOf"))
            collapsed[key] = value?.DeepClone();
        foreach (var (key, value) in reference)
            collapsed[key] = value?.DeepClone();
        return collapsed;
    }
}

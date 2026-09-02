namespace LupiraCalBff.Dtos;

/// <summary>
/// What the contact detail pane needs beyond the contact itself. The SPA used to fetch this by
/// reading the contact, then its address book's groups, then *every* contact in that book just to
/// name a handful of emergency contacts — two serial round trips, because the group call needs the
/// address book id the first call returns.
/// </summary>
public sealed class ContactContextDto
{
    /// <summary>Groups the contact belongs to.</summary>
    public required IReadOnlyList<ContactGroupRefDto> MemberOf { get; set; }

    /// <summary>Groups in the same address book it could be added to.</summary>
    public required IReadOnlyList<ContactGroupRefDto> Joinable { get; set; }

    /// <summary>The contact's emergency contacts, resolved to names, in the order it declares them.</summary>
    public required IReadOnlyList<ContactRefDto> EmergencyContacts { get; set; }
}

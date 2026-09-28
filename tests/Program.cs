using BotRandomizer;

var root = args.Single();
var catalog = CosmeticCatalog.Load(Path.Combine(root, "cosmetic_catalog.json"));
var placements = CharmPlacementCatalog.Load(Path.Combine(root, "charm_placements.json"), catalog);
var roller = new CosmeticRoller(catalog, placements, new Random(42));
for (var i = 0; i < 100; i++)
{
    var loadout = roller.RollLoadout((byte)(i % 2 + 2));
    if (!catalog.MusicKits.Contains(loadout.MusicKit)) throw new Exception("Unknown music kit");
    foreach (var weapon in catalog.Weapons)
    {
        var selection = roller.GetOrCreateWeapon(loadout, weapon.DefIndex)
            ?? throw new Exception("Weapon did not receive a cosmetic selection");
        var paint = weapon.Paints.Single(p => p.PaintKit == selection.PaintKit);
        if (selection.Wear < paint.WearMin - 0.001f || selection.Wear > paint.WearMax + 0.001f)
            throw new Exception("Wear outside paint range");
        if (!ReferenceEquals(selection, roller.GetOrCreateWeapon(loadout, weapon.DefIndex)))
            throw new Exception("Existing weapon was rerolled");
        foreach (var sticker in selection.Stickers)
            if (!catalog.StickerKits.Any(s => s.DefIndex == sticker.DefIndex))
                throw new Exception("Unknown sticker");
    }
}
Console.WriteLine($"Catalog and stable loadouts passed: {catalog.WeaponCount} weapons, {catalog.StickerKits.Count} stickers.");

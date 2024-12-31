# Quest randomizer
Tired of running the same quests every time you start a new playthrough? This mod might spice things up. Change the kill requirements for quests so you fight new enemies with new weapons in new places. Also changes the hand over item quests to require new items. Perhaps some items will be more useful now. You wont know until you encounter each quest.
The mod is very configurable. See ``config/config.jsonc`` for a LOT more information.

Will change the following:
- Randomize the item hand over of quests.
    - Uses a list of items in tiers similar to my Barter Economy mod. See the ``assets/data/itemtierlist.jsonc`` file for more details.
    - Add hand over to quests that don't have them.
- Randomize kill quests in the following ways (configurable in the config)
    - Add kill objectives to quests that don't have them.
    - Add/Randomize gear requirements.
        - See the ``assets/data/gearlist.jsonc`` file for more details.
    - Add/Randomize the kill targets.
    - Add/Randomize the distance requirement.
    - Add/Randomize the required location.
    - Add/Randomize the required time of day.
    - Add/Randomize the required weapons. Using both a bunch of tailor-made categories, and individual weapons.
        - See the ``assets/data/weaponcategories.jsonc`` file for more details
        - Once the server has started once with this mod. You can find an auto-generated category list in all supported languages in the ``categories/`` folder of this mod.
    - Add/Randomize the body part requirement.
- Adds a new category in the handbook that shows weapon categories and mods.

Current Shortcomings
- Removes durability for handover quests.
- Doesn't have a counter for "found" items for handover quests. (The thing most- but not all BSG handover quests have.) Just a visual thing. Minor.

## Compatibility
If you made a weapon mod, or just want to make a weapon mod compatible with the randomized quests. I have provided three ways of doing it.
- Method 1: (user) add weapon to new or existing weapon categories.
- Method 2: (user) add weapon equivalents.
- Method 3: (modder) API calls

### Method 1 - Weapon Categories
The first way is to simply add the weapon IDs to the weapon categories in ``assets/data/weaponcategories.jsonc``. There is more info on how it works inside the file.

### Method 2 - Weapon Compatibility
The last two ways uses what I call "weapon equivalents" where you match the ID of a new weapon with a vanilla weapon. For example a mod adds a shiny m4a1. If I make that weapon equivalent with the regular m4a1. Then all quests that have a required weapon of m4a1 will also get the shiny m4a1 as a usable weapon for that quest. There can be multiple equivalents per original weapon. There is no limit.

The second way that is recommended for users is to add weapon equivalents to the ``config/weaponCompatibility.jsonc`` file. 
```json
"equivalents":
[
    {
        "originalWeaponID":"5447a9cd4bdc2dbd208b4567", // Original m4a1
        "equivalentWeaponID":"66fd8da18afded28fc000001" // Shiny M4a1
    },
    {
        "originalWeaponID":"576165642459773c7a400233", // Original Saiga 12k
        "equivalentWeaponID":"66fd8da18afded28fc00000d" // Shiny Saiga 12k
    },
]
```


### Method 3 - API
The third and last way that I recommend for mod developers if they like to add compatibility is to use an API I have provided. Below are instructions on how to use it. The end effect is the same as ``Method 2``, but can be done programmatically.

The API inits during ``preSptLoad``, but to ensure load-order is not a problem, I recommend calling during ``postDBLoad``. The actual injection of weapon equivalents happens on profile load. Enable ``debug`` in ``config/config.jsonc`` if you want visual confirmation that your API-call worked.

First you need to resolve the API from the container. (Example copied from my shiny airdrop mod)
```ts
//Check for quest randomizer compatibility
logger.log( "[ShinyAirdropGuns] Checking if Questrandomizer is installed");
try
{
    this.leavesQuestrandomizerCompatibility = container.resolve<unknown>( "LeavesQuestrandomizerCompatibility" );
    if ( this.leavesQuestrandomizerCompatibility !== undefined )
    {
        logger.log( "[ShinyAirdropGuns] Questrandomizer found! Adding shiny weapons to randomized quests!");
    }
}
catch (e)
{
    logger.log( "[ShinyAirdropGuns] Questrandomizer cannot be found. Continuing as normal" );
}
```
Once you have resolved the compatibility layer. You can simply do a call like this to add your weapon ID. T

```ts
if ( this.leavesQuestrandomizerCompatibility !== undefined )
{
    // @ts-ignore
    this.leavesQuestrandomizerCompatibility.addWeaponEquivalent( originalWeapon, newWeapon );
}
```
<sub>Footnote: the ``// @ts-ignore`` will suppress the warning that VScode will give you for trying to call a method it doesn't know about, but it will work.</sub>

### Translation Credits
- German - ``Friend B``
- Polish - ``Friend M``
- French - ``trippy``
- Korean - ``Rising_Star``
- Spanish - ``Strungerman``
- Portuguese - ``SoundBlaster1998``
- Latin American Spanish - ``UralreadyDead``
- Russian - ``GhostFenixx`` & ``Friend B2``
- Chinese - ``Echo``
- EVERYONE ON CROWDIN https://crowdin.com/project/spt-questrandomizer/members

# Changelog
## 0.0.1
- Initial beta release

## 0.0.2
- Remade the localization system
- Added SpecificWeapon chance

## 0.0.3
- Added locale for de, fr, and pl
- Added config on how many maps should be for kill quests. 
- Looking for translators, for all tarkov languages except: EN, RU, PL, NL, SE, UA, DE, FR
- Actually made the new locale system load. Oops. 

## 0.0.4
- Quest whitelist toggle in config, in case other mods get angy. (Default Off)
- Fix incompatibility with TRAP Custom Quests (Technically the issue is with their mod. But whatever.)

## 0.0.4h1
- Fix whitelist preventing quests from generating when turned off. rofl. 

## 0.0.5
- Korean Translation - Many thanks to ``Rising_Star``
- Spanish Translation - Many thanks to ``Strungerman``
- Add a list of quests that can't get "harder" maps. Configurable in config.

## 0.0.6
- Added missing "Bloodhound" to name list. 
- Updated RU translation
- Allow parents to be used in the ``handoverItemBlacklist`` and added "Ammo" parent to that list as a default.
- Added ES-MX Translation - Many thanks to ``UralreadyDead`
- Added ``chanceHandoverNeedsFIR`` property to decide if handover quest items needs to be found in raid.
- Added ``chanceToEditHandoverCondition`` property to decide if we even want to edit handover stuff.
- Added ``chanceToEditKillConditions`` property to decide if we even want to edit kill  stuff.
- Easy quests now also don't randomize as much for kill quests. (renamed config property to ``easierQuestList``)
- - Uses Easier map list
- - Does not ADD body part requirements
- - Does not ADD time of day requirements 
- - Does not ADD distance requirements
- - Does not ADD/EDIT gear requirements
- - Does not EDIT weapon requirements 
- Added chance and config for handover quests requiring from categories rather than individual items. 
- Added ``chanceToAddHandoverCondition`` which is a chance to add a handover condition to quests.
- Localization for handover categories. (Working on doing the same for weapon categories.)

## 0.0.7
- Added weapon- and mod-category items into the handbook so you can see them in-game.
- Portuguese translation - Many thanks to ``SoundBlaster1998`` 
- Chinese translation - Many thanks to ``Echo``
- Added mod categories, and reworked the whole weapon categories file. You can now add weapon mod categories to other categories. Example adding silencer mod category to AKM-series weapon category.
- Added more weapon and mod-categories to the default config.

## 0.0.8
- Massive reworks of behind the scenes. (Quest generation coming soon)
- Remove ZONE requirements for now. (This might have bricked quests in earlier versions, for that I sincerely apologize.)
- Added ratios between scavs/pmcs/any so that quests that convert to other things will have their kill counts adjusted.

## 0.0.9
- Fix issue with quests handover-tasks sometimes not being randomized.
- Show found in raid requirements (oops)
- Safeguard against other mods adding broken items to quests.

## 0.1.0
- Major rework. Quests are now on a per-profile basis. I have tried to test this as extensively as possible. But consider this even more of a beta than previous releases.
- Add localization for weapon groups. (Uses locale, then en, and lastly the weapon group name string)
- Cleaned up console spam if Debug isn't enabled.
- Unload profiles if they've been inactive for a while.

## 0.2.0
This will be the last version before 3.10
- Check for missing properties more. (Adds compat with AQM)
- Enabled quest whitelist by default (Which by default includes all vanilla quests)
- Changed quest whitelist location to be it's own folder. This is to make it easy to enable/disable whitelists from other mods. You might not want to randomize AQM, but maybe you've played a ton of other quests mods before, and want them randomized. 
- Add a trader whitelist, letting you decide what traders to randomize and not. This is in addition to all previously mentioned whitelisting stuff.
- XP multiplier for quests. In case you want to have more or less xp from quests. Useful for ensuring the quest progression matches level and trader progression.
- Added first iteration of generated quests. (They're still quite bare-bones, but will be improved upon in the future.)
- - Added generated weapon quests. 
- - Added generated sniper quests.
- - Added generated handover quests.
- Fixed bug that made "hard" locations sometimes appear on "easy" quests.
- Added multiple options for compatibility with mods that add new weapons to work with quests. (See ``readme.md`` for more info)

## 0.2.1
- 3.10.0 Release
- Cleaned up output to be neater.

## 0.2.2
- Fix filepath in linux (capitalization)
- Fix missing locale for usec/bear in kill quests (name changed in 3.10)
- Fix easy quests with weapon requirements becoming invisible.

Can be applied to existing profile. Will not fix the locale for invisible quests requirement. (Should only be stirrup in default settings(use pistols to complete the quest))

## 0.2.3
- Fix issue with weapon mods not getting purged when randomizing kill quests.
- Newest locale updates from crowdin. Thank you everyone!

Will not fix already generated quests.

## 0.2.4
- Fix issue of generating the wrong amount of sniper quests. Thanks to Jaxander for finding this issue.
- Add DVL 500mm barrel to big silencer category.
- Purge enemyHealthEffects from randomized quests.
- Added an option to disable the rainbow "Found in raid" text. You need to make a new profile for it to take effect.


Will not fix already generated quests.

## 0.3.0
- Made quests difficulty depend on how far in the quest is. (Scales of level and depth)
- - Earlier quests are easier
- - Later quests are harder
- - All Configurable in the config. Like always.
- Blacklisted the handbook items in the fence blacklist.
- Blacklisted the handbook items in the generic item blacklist.

Note: From extensive testing, it seems mostly fine to re-generate quests on an already existing profile. You might lose progress is some parts of some quests. Always make a backup first. No support will be provided. To do this, remove the folder matching your profile ID from ``user/mods/questrandomizer/assets/generated/<id>``.

Will not fix already generated quests.
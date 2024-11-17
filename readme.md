# Quest randomizer
Tired of running the same quests every time you start a new playthrough? This mod might spice things up. Change the kill requirements for quests so you fight new enemies with new weapons in new places. Also changes the hand over item quests to require new items. Perhaps some items will be more useful now. You wont know until you encounter each quest.
The mod is very configurable. See ``config/config.jsonc`` for a LOT more information.

Will change the following:
- Randomize the item hand over of quests.
    - Uses a list of items in tiers similar to my Barter Economy mod. See the ``config/itemtierlist.jsonc`` file for more details.
    - Add hand over to quests that don't have them.
- Randomize kill quests in the following ways (configurable in the config)
    - Add kill objectives to quests that don't have them.
    - Add/Randomize gear requirements.
        - See the ``config/gearlist.jsonc`` file for more details.
    - Add/Randomize the kill targets.
    - Add/Randomize the distance requirement.
    - Add/Randomize the required location.
    - Add/Randomize the required time of day.
    - Add/Randomize the required weapons. Using both a bunch of tailor-made categories, and individual weapons.
        - See the ``config/weaponcategories.jsonc`` file for more details
        - Once the server has started once with this mod. You can find an auto-generated category list in all supported languages in the ``categories/`` folder of this mod.
    - Add/Randomize the body part requirement.
- Adds a new category in the handbook that shows weapon categories and mods.

Current Shortcomings
- Removes durability for handover quests.
- Doesn't have a counter for "found" items for handover quests. (The thing most- but not all BSG handover quests have.) Just a visual thing. Minor.

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

## 0.1.1
- Check for missing properties more. (Adds compat with AQM)
- Enabled quest whitelist by default (Which by default includes all vanilla quests)
- Changed quest whitelist location to be it's own folder. This is to make it easy to enable/disable whitelists from other mods. You might not want to randomize AQM, but maybe you've played a ton of other quests mods before, and want them randomized. 
- Add a trader whitelist, letting you decide what traders to randomize and not. This is in addition to all previously mentioned whitelisting stuff.
- XP multiplier for quests. In case you want to have more or less xp from quests. Useful for ensuring the quest progression matches level and trader progression.
- Added generated weapon quests. They're a bit basic for now. But will be improved over time.
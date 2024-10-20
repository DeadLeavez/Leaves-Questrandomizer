# Quest randomizer
Tired of running the same quests every time you start a new playthrough? This mod might spice things up. Change the kill requirements for quests so you fight new enemies with new weapons in new places. Also changes the hand over item quests to require new items. Perhaps some items will be more useful now. You wont know until you encounter each quest.

Will change the following:
- Randomize the item hand over of quests.
    - Uses a list of items in tiers similar to my Barter Economy mod. See the ``confg/itemtierlist.jsonc`` file for more details.
- Randomize kill quests in the following ways (configurable in the config)
    - Add kill objectives to quests that dont have them.
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
# object: Shopkeeper
# sprite: npc_shop
# parent: Person
# Buys nothing, sells everything.

# === create
super().on_create()
self.use = shop_menu

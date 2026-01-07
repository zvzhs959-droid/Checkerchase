/**
 * STONEWAVE DUEL - STORAGE SYSTEM
 * Handles persistent data (Stars, Inventory) via localStorage.
 */
(function() {
    window.flux = window.flux || {};

    const STORAGE_KEY = 'stonewave_save_v1';

const DEFAULT_DATA = {
        stars: 0,
        inventory: [],     // List of owned item IDs (strings)
        equipped: {        // Slots
            HEAD: null,
            BACK: null
        }
    };

    class StorageManager {
        constructor() {
            this.data = null;
            this.load();
        }

        /**
         * Load data from localStorage or initialize defaults.
         */
        load() {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (raw) {
                    // Merge with default to ensure structure exists (handle schema updates)
                    const parsed = JSON.parse(raw);
                    this.data = { ...DEFAULT_DATA, ...parsed };
                    
                    // Safety checks & Migration
                    if (!Array.isArray(this.data.inventory)) this.data.inventory = [];
                    
                    // Migrate legacy 'equipped' string to object
                    if (typeof this.data.equipped === 'string' || this.data.equipped === null) {
                        const oldId = this.data.equipped;
                        this.data.equipped = { HEAD: null, BACK: null };
                        
                        // Attempt to restore old item to correct slot
                        if (typeof oldId === 'string' && window.flux.config) {
                            const items = window.flux.config.SHOP.ITEMS;
                            for (const k in items) {
                                if (items[k].id === oldId) {
                                    this.data.equipped[items[k].type] = oldId;
                                    break;
                                }
                            }
                        }
                    }
                    // Ensure all slots exist
                    if (!this.data.equipped.HEAD) this.data.equipped.HEAD = null;
                    if (!this.data.equipped.BACK) this.data.equipped.BACK = null;

                } else {
                    this.data = JSON.parse(JSON.stringify(DEFAULT_DATA));
                }
            } catch (e) {
                console.warn("FluxCode: Save data corrupted or disabled. Resetting.", e);
                this.data = JSON.parse(JSON.stringify(DEFAULT_DATA));
            }
            console.log("FluxCode: Storage Loaded.", this.data);
        }

        /**
         * Persist current data to localStorage.
         */
        save() {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
            } catch (e) {
                console.error("FluxCode: Save failed.", e);
            }
        }

        // --- CURRENCY (STARS) ---

        getStars() {
            return this.data.stars;
        }

        addStars(amount) {
            this.data.stars += amount;
            this.save();
            console.log(`FluxCode: Added ${amount} stars. Total: ${this.data.stars}`);
            return this.data.stars;
        }

        spendStars(amount) {
            if (this.data.stars >= amount) {
                this.data.stars -= amount;
                this.save();
                return true;
            }
            return false;
        }

        // --- INVENTORY ---

        hasItem(itemId) {
            return this.data.inventory.includes(itemId);
        }

        unlockItem(itemId) {
            if (!this.hasItem(itemId)) {
                this.data.inventory.push(itemId);
                this.save();
                console.log(`FluxCode: Unlocked item '${itemId}'`);
            }
        }

        // --- EQUIPMENT ---

        equipItem(itemId) {
            const items = window.flux.config.SHOP.ITEMS;
            let itemType = null;

            // Find item type
            for (const k in items) {
                if (items[k].id === itemId) {
                    itemType = items[k].type;
                    break;
                }
            }

            if (!itemType) {
                console.warn(`FluxCode: Unknown item '${itemId}'`);
                return false;
            }
            
            // Must own it
            if (this.hasItem(itemId)) {
                this.data.equipped[itemType] = itemId;
                this.save();
                console.log(`FluxCode: Equipped '${itemId}' to ${itemType}`);
                return true;
            }
            
            console.warn(`FluxCode: Cannot equip '${itemId}' - not owned.`);
            return false;
        }

        unequipItem(itemId) {
            // Find which slot holds this item
            for (const slot in this.data.equipped) {
                if (this.data.equipped[slot] === itemId) {
                    this.data.equipped[slot] = null;
                    this.save();
                    console.log(`FluxCode: Unequipped '${itemId}' from ${slot}`);
                    return true;
                }
            }
            return false;
        }

        isEquipped(itemId) {
            return this.data.equipped.HEAD === itemId || this.data.equipped.BACK === itemId;
        }

        getEquippedSlots() {
            return this.data.equipped;
        }
        // --- DEBUG ---
        reset() {
            this.data = JSON.parse(JSON.stringify(DEFAULT_DATA));
            this.save();
            console.log("FluxCode: Save data reset.");
        }
    }

    // Initialize immediately
    window.flux.storage = new StorageManager();
})();
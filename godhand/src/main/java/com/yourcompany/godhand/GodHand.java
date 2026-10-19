package com.yourcompany.godhand;
import net.fabricmc.fabric.api.networking.v1.PayloadTypeRegistry;
import com.yourcompany.godhand.network.*;


import com.mojang.brigadier.Command;
import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.context.CommandContext;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.fabricmc.fabric.api.entity.event.v1.ServerLivingEntityEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayNetworking;

import net.minecraft.command.CommandRegistryAccess;
import net.minecraft.command.argument.EntityArgumentType;
import net.minecraft.entity.Entity;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.mob.PathAwareEntity;
import net.minecraft.server.command.CommandManager;
import net.minecraft.server.command.ServerCommandSource;
import net.minecraft.text.Text;
import net.minecraft.util.Identifier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import net.minecraft.server.world.ServerWorld;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerEntityEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.entity.effect.StatusEffects;
import net.minecraft.server.network.ServerPlayerEntity;

import java.util.UUID;
import java.util.List;
import java.util.stream.Collectors;

import com.yourcompany.godhand.util.IEntityDataSaver;
import net.minecraft.entity.projectile.ArrowEntity;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;

import com.yourcompany.godhand.item.ModItems;
import net.minecraft.entity.mob.HostileEntity;
import net.minecraft.util.math.Box;

import java.util.concurrent.CompletableFuture;


import static net.minecraft.server.command.CommandManager.argument;
import static net.minecraft.server.command.CommandManager.literal;

/**
 * Die Hauptklasse der GodHand Mod, die die Initialisierung, Befehlsregistrierung und Ereignisbehandlung übernimmt.
 */
public class GodHand implements ModInitializer {
    /**
     * Default constructor for GodHand.
     */
    public GodHand() {
        super();
    }

	/** Die Mod-ID der GodHand Mod. */
	public static final String MOD_ID = "godhand";
	/** Der Logger für die GodHand Mod. */
	public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);
	/** Gibt an, ob die Mod erfolgreich initialisiert wurde. */
	public static boolean isInitializedSuccessfully = false;
	/** Der Identifier für das Teleport-Begleiter-Paket. */
	public static final Identifier TELEPORT_COMPANION_PACKET_ID = Identifier.of(MOD_ID, "teleport_companion");
    /** Der Identifier für das Freigabe-Begleiter-Paket. */
    public static final Identifier RELEASE_COMPANION_PACKET_ID = Identifier.of(MOD_ID, "release_companion");
    /** Identifier für das Paket zur Abfrage des Begleiterstatus vom Client zum Server. */
    public static final Identifier C2S_REQUEST_COMPANION_STATUS_PACKET_ID = Identifier.of(MOD_ID, "request_companion_status");
    /** Identifier für das Paket zur Antwort auf den Begleiterstatus vom Server zum Client. */
    public static final Identifier S2C_COMPANION_STATUS_RESPONSE_PACKET_ID = Identifier.of(MOD_ID, "response_companion_status");

	/**
	 * Wird beim Initialisieren der Mod aufgerufen. Registriert Ereignisse, Befehle und Netzwerk-Receiver.
	 */
	@Override
	public void onInitialize() {
		LOGGER.info("Hello Fabric world!");
		// Setzt den globalen UncaughtExceptionHandler
		Thread.setDefaultUncaughtExceptionHandler((thread, e) -> {
			GodHand.LOGGER.error("Uncaught exception in thread " + thread.getName(), e);
		});

		try {
			// Lade Konfiguration zuerst

			ModItems.registerModItems();

			// Registriere Lifecycle-Ereignisse für Begleiter-Tracking
			ServerEntityEvents.ENTITY_LOAD.register((entity, world) -> {
				if (entity instanceof LivingEntity livingEntity) {
					CompanionManager.registerCompanion(livingEntity);
				} else if (entity instanceof ArrowEntity arrow) {
					ArrowManager.onArrowLoad(arrow, world);
				} else if (entity instanceof net.minecraft.entity.ItemEntity itemEntity) {
                    net.minecraft.item.ItemStack stack = itemEntity.getStack();
                    if (stack.isOf(net.minecraft.item.Items.BOW) && stack.contains(net.minecraft.component.DataComponentTypes.CUSTOM_NAME)) {
                        String name = stack.getName().getString();
                        if (name.equals("God Hand Bow") || name.equals("Magic Bow")) {
                            // Find nearest player as fallback if we can't directly get thrower
                            java.util.List<net.minecraft.entity.player.PlayerEntity> players = world.getEntitiesByClass(
                                net.minecraft.entity.player.PlayerEntity.class,
                                itemEntity.getBoundingBox().expand(10.0),
                                net.minecraft.entity.Entity::isAlive
                            );

                            if (!players.isEmpty()) {
                                net.minecraft.entity.player.PlayerEntity player = players.get(0);
                                if (player.getInventory().insertStack(stack)) {
                                    itemEntity.discard();
                                }
                            }
                        }
                    }
                }
			});

			ServerEntityEvents.ENTITY_UNLOAD.register((entity, world) -> {
				if (entity instanceof LivingEntity livingEntity) {
					CompanionManager.unregisterCompanion(livingEntity);
				} else if (entity instanceof ArrowEntity arrow) {
					ArrowManager.unregisterArrow(arrow);
				}
			});

			GodHandConfig config = GodHandConfig.getInstance();
			if (config == null) {
				throw new RuntimeException("Failed to load GodHand configuration");
			}

			// Registriere Keybinds

            if (net.fabricmc.loader.api.FabricLoader.getInstance().getEnvironmentType() == net.fabricmc.api.EnvType.CLIENT) {
				GodHandKeybinds.register();
			}


			// Registriere Schadensereignisse
			ServerLivingEntityEvents.ALLOW_DAMAGE.register((entity, source, amount) -> {
				try {
					return GodHandFeatures.handleDamage(entity, source, amount);
				} catch (Exception e) {
					LOGGER.error("Error handling damage event", e);
					return true; // Standard: Schaden zulassen bei Fehler
				}
			});

			// Registriere Todesereignisse
			ServerLivingEntityEvents.AFTER_DEATH.register((entity, source) -> {
				try {
					// Companion Death Message
					if (entity instanceof LivingEntity && CompanionManager.isCompanion(entity)) {
						UUID ownerUuid = CompanionManager.getOwnerUuid(entity);
						if (ownerUuid != null && entity.getServer() != null) {
							ServerPlayerEntity owner = entity.getServer().getPlayerManager().getPlayer(ownerUuid);
							if (owner != null) {
								owner.sendMessage(Text.translatable("godhand.chat.companion.died", entity.getName()), false);
							}
						}
					}

					// Super Bow Kill Message
					if (source.getSource() instanceof ArrowEntity arrow) {
						if (((IEntityDataSaver)arrow).getPersistentData().getBoolean("godhand_super_bow_arrow")) {
							if (arrow.getOwner() instanceof ServerPlayerEntity player) {
								player.sendMessage(Text.translatable("godhand.chat.superbow.kill", entity.getName()), false);
							}
						}
					}
				} catch (Exception e) {
					LOGGER.error("Error handling death event", e);
				}
			});

			// Registriere Server-Befehle
			CommandRegistrationCallback.EVENT.register(this::registerCommands);



			// Registriere Server-Tick-Ereignisse
			ServerTickEvents.END_SERVER_TICK.register(server -> {
				// Optimization: Rate-limit expensive sneak-glow logic to every 10 ticks (approx. 2 times per second)
				if (server.getTicks() % 10 == 0) {
					for (net.minecraft.server.network.ServerPlayerEntity player : server.getPlayerManager().getPlayerList()) {
						// Optimized: Check for items and reduced search radius
						if (player.isSneaking()) {
							ItemStack mainStack = player.getMainHandStack();
							ItemStack offStack = player.getOffHandStack();
							boolean isMatch = false;

							// Check for Magic Bow item or renamed standard bows
							if (mainStack.isOf(ModItems.MAGIC_BOW) || offStack.isOf(ModItems.MAGIC_BOW)) {
								isMatch = true;
							} else if (mainStack.isOf(Items.BOW) || offStack.isOf(Items.BOW)) {
								if (mainStack.contains(net.minecraft.component.DataComponentTypes.CUSTOM_NAME)) {
									String name = mainStack.getName().getString();
									if (name.equals("God Hand Bow") || name.equals("Magic Bow")) isMatch = true;
								}
								if (!isMatch && offStack.contains(net.minecraft.component.DataComponentTypes.CUSTOM_NAME)) {
									String name = offStack.getName().getString();
									if (name.equals("God Hand Bow") || name.equals("Magic Bow")) isMatch = true;
								}
							}

							if (isMatch) {
								// Reduced search radius from 50.0 to 20.0 for better performance (15.6x smaller volume)
								java.util.List<net.minecraft.entity.LivingEntity> entities = player.getWorld().getEntitiesByClass(
									net.minecraft.entity.LivingEntity.class,
									player.getBoundingBox().expand(20.0),
									e -> e != player
								);
								for (net.minecraft.entity.LivingEntity entity : entities) {
									entity.addStatusEffect(new net.minecraft.entity.effect.StatusEffectInstance(net.minecraft.entity.effect.StatusEffects.GLOWING, 15, 0, false, false));
								}
							}
						}
					}
				}

				try {
					for (ServerWorld world : server.getWorlds()) {
						PlayerFeatures.handleSuperBow(world);
					}

					// Effiziente Anwendung von Begleiter-Effekten mit dem neuen Tracking-System
					List<LivingEntity> allActiveCompanions = List.copyOf(CompanionManager.getActiveCompanions());

					// Parallele Verarbeitung der Begleiter-Effekte für bessere Performance
					CompletableFuture.runAsync(() -> {
						GodHandConfig.CompanionConfig companionConfig = config.companion;
						for (LivingEntity companion : allActiveCompanions) {
							if (companion.isAlive()) {
								server.execute(() -> {
									if (companionConfig.giveRegenerationEffect) {
										companion.addStatusEffect(new StatusEffectInstance(StatusEffects.REGENERATION, 20 * 5, 1, false, false));
									}
									if (companionConfig.giveStrengthEffect) {
										companion.addStatusEffect(new StatusEffectInstance(StatusEffects.STRENGTH, 20 * 5, 1, false, false));
									}
									if (companionConfig.giveSpeedEffect) {
										companion.addStatusEffect(new StatusEffectInstance(StatusEffects.SPEED, 20 * 5, 1, false, false));
									}
									if (companionConfig.giveResistanceEffect) {
										companion.addStatusEffect(new StatusEffectInstance(StatusEffects.RESISTANCE, 20 * 5, 1, false, false));
									}
								});
							}
						}
					}).exceptionally(throwable -> {
						LOGGER.error("Error applying companion effects asynchronously", throwable);
						return null;
					});
				} catch (Exception e) {
					LOGGER.error("Error in server tick event", e);
				}
			});

			// Registriere Netzwerk-Receiver
			registerServerReceivers();

        PayloadTypeRegistry.playC2S().register(UpdateBowWhitelistPacket.ID, UpdateBowWhitelistPacket.CODEC);
        PayloadTypeRegistry.playC2S().register(OpenBowWhitelistScreenPacket.ID, OpenBowWhitelistScreenPacket.CODEC);
        PayloadTypeRegistry.playC2S().register(ToggleMagicBowPacket.ID, ToggleMagicBowPacket.CODEC);
        PayloadTypeRegistry.playS2C().register(S2COpenBowWhitelistScreenPacket.ID, S2COpenBowWhitelistScreenPacket.CODEC);
        PayloadTypeRegistry.playS2C().register(SyncBowWhitelistPacket.ID, SyncBowWhitelistPacket.CODEC);


			isInitializedSuccessfully = true;
			LOGGER.info("GodHand Mod initialized successfully!");
		} catch (Exception e) {
			isInitializedSuccessfully = false;
			LOGGER.error("Failed to initialize GodHand Mod!", e);
		}
	}

	/**
	 * Registriert die Server-Netzwerk-Receiver für die Mod.
	 */
	
    private void registerServerReceivers() {
        ServerPlayNetworking.registerGlobalReceiver(UpdateBowWhitelistPacket.ID, (payload, context) -> {
            context.server().execute(() -> {
                if (!context.player().hasPermissionLevel(2)) {
                    LOGGER.warn("Player {} tried to modify Bow Whitelist without permission!", context.player().getName().getString());
                    return;
                }
                BowWhitelistManager.updatePlayerWhitelist(context.server(), payload.input(), payload.add());
            });
        });

        ServerPlayNetworking.registerGlobalReceiver(OpenBowWhitelistScreenPacket.ID, (payload, context) -> {
            context.server().execute(() -> {
                if (context.player().hasPermissionLevel(2)) {
                    ServerPlayNetworking.send(context.player(), new S2COpenBowWhitelistScreenPacket());
                }
            });
        });

        ServerPlayNetworking.registerGlobalReceiver(ToggleMagicBowPacket.ID, (payload, context) -> {
            context.server().execute(() -> {
                if (context.player().hasPermissionLevel(2)) {
                    if (context.player() instanceof com.yourcompany.godhand.util.IEntityDataSaver saver) { boolean current = saver.getPersistentData().getBoolean("magicBowEnabled"); saver.getPersistentData().putBoolean("magicBowEnabled", !current); }
                }
            });
        });
    }

	/**
	 * Registriert die Server-Befehle für die Mod.
	 * @param dispatcher Der CommandDispatcher.
	 * @param registryAccess Der CommandRegistryAccess.
	 * @param environment Die Registrierungsumgebung.
	 */
    public void registerCommands(CommandDispatcher<ServerCommandSource> dispatcher, CommandRegistryAccess registryAccess, CommandManager.RegistrationEnvironment environment) {
		dispatcher.register(literal("godhand")
				.requires(source -> source.hasPermissionLevel(2))
				.then(literal("godmode")
						.then(literal("on").executes(context -> setGodMode(context.getSource(), true)))
						.then(literal("off").executes(context -> setGodMode(context.getSource(), false)))
						.then(literal("toggle").executes(context -> toggleGodMode(context.getSource())))
						.then(literal("c").executes(context -> setCreativeMode(context.getSource())))
				)
				.then(literal("companion")
						.then(literal("recruit")
								.then(argument("entity", EntityArgumentType.entity())
										.executes(context -> recruitCompanionCommand(context))))
						.then(literal("recruit_nearest").executes(context -> recruitNearestCompanionCommand(context.getSource())))
						.then(literal("release")
								.then(argument("entity", EntityArgumentType.entity())
										.executes(context -> releaseCompanionCommand(context))))
						.then(literal("release_all").executes(context -> releaseAllCompanionsCommand(context.getSource())))
						.then(literal("teleport")
								.then(argument("entity", EntityArgumentType.entity())
										.executes(context -> teleportCompanionCommand(context))))
				)
				.then(literal("player")
						.then(literal("superbow").executes(context -> toggleSuperBowCommand(context.getSource())))
						.then(literal("invulnerable").executes(context -> toggleInvulnerableCommand(context.getSource())))
				)
						          .then(literal("bowwhitelist")
										  .requires(source -> source.hasPermissionLevel(2))
										  .executes(context -> {
						              // This command is handled client-side and sends a packet to the server.
						              // The server then opens the screen on the client.
						              // This is a bit of a workaround to get the server instance on the client.
						              return 0;
						          }))
		);
	}

	/**
	 * Setzt den God Mode Status für den Spieler.
	 * @param source Die Befehlsquelle.
	 * @param enable True, um den God Mode zu aktivieren, false zum Deaktivieren.
	 * @return Command.SINGLE_SUCCESS, wenn der Befehl erfolgreich war, sonst 0.
	 */
	private int setGodMode(ServerCommandSource source, boolean enable) {
		if (GodHandConfig.getInstance().godMode.godModeSettingsLocked) {
			source.sendError(Text.translatable("godhand.chat.godmode.settings_are_locked"));
			return 0;
		}
		GodHandConfig.getInstance().godMode.enabled = enable;
		GodHandConfig.saveAsync(GodHandConfig.getInstance());
		if (source.getPlayer() != null) {
			source.getPlayer().sendMessage(Text.translatable("text.godhand.chat.godmode.toggled", enable ? Text.translatable("options.on") : Text.translatable("options.off")), false);
		}
		return Command.SINGLE_SUCCESS;
	}

	/**
	 * Führt den Befehl zum Rekrutieren eines Begleiters aus.
	 * @param context Der Befehlskontext.
	 * @return Command.SINGLE_SUCCESS, wenn der Befehl erfolgreich war.
	 */
	private int recruitCompanionCommand(CommandContext<ServerCommandSource> context) {
		try {
			LivingEntity targetEntity = (LivingEntity) EntityArgumentType.getEntity(context, "entity");
			if (targetEntity instanceof PathAwareEntity pathAwareEntity) {
				CompanionManager.recruitCompanion(context.getSource().getPlayer(), pathAwareEntity);
			} else {
				context.getSource().sendError(Text.translatable("godhand.command.companion.not_recruitable"));
			}
		} catch (Exception e) {
			context.getSource().sendError(Text.translatable("godhand.command.companion.recruit_failed"));
			GodHand.LOGGER.error("Failed to recruit companion: ", e);
		}
		return Command.SINGLE_SUCCESS;
	}

	/**
	 * Führt den Befehl zum Freigeben eines Begleiters aus.
	 * @param context Der Befehlskontext.
	 * @return Command.SINGLE_SUCCESS, wenn der Befehl erfolgreich war.
	 */
	private int releaseCompanionCommand(CommandContext<ServerCommandSource> context) {
		try {
			LivingEntity targetEntity = (LivingEntity) EntityArgumentType.getEntity(context, "entity");
			if (targetEntity instanceof PathAwareEntity pathAwareEntity) {
				CompanionManager.releaseCompanion(context.getSource().getPlayer(), pathAwareEntity);
			} else {
				context.getSource().sendError(Text.translatable("godhand.command.companion.not_a_companion"));
			}
		} catch (Exception e) {
			context.getSource().sendError(Text.translatable("godhand.command.companion.release_failed"));
			GodHand.LOGGER.error("Failed to release companion: ", e);
		}
		return Command.SINGLE_SUCCESS;
	}

	/**
	 * Schaltet den God Mode Status für den Spieler um.
	 * @param source Die Befehlsquelle.
	 * @return Command.SINGLE_SUCCESS, wenn der Befehl erfolgreich war, sonst 0.
	 */
	private int toggleGodMode(ServerCommandSource source) {
		if (GodHandConfig.getInstance().godMode.godModeSettingsLocked) {
			source.sendError(Text.translatable("godhand.chat.godmode.settings_are_locked"));
			return 0;
		}
		boolean newStatus = !GodHandConfig.getInstance().godMode.enabled;
		GodHandConfig.getInstance().godMode.enabled = newStatus;
		GodHandConfig.saveAsync(GodHandConfig.getInstance());
		if (source.getPlayer() != null) {
			source.getPlayer().sendMessage(Text.translatable("text.godhand.chat.godmode.toggled", newStatus ? Text.translatable("options.on") : Text.translatable("options.off")), false);
		}
		return Command.SINGLE_SUCCESS;
	}

	/**
	 * Versetzt den Spieler in den Kreativmodus, wenn God Mode aktiviert ist.
	 * @param source Die Befehlsquelle.
	 * @return Command.SINGLE_SUCCESS, wenn der Befehl erfolgreich war, sonst 0.
	 */
	private int setCreativeMode(ServerCommandSource source) {
		if (source.getPlayer() != null) {
			if (GodHandConfig.getInstance().godMode.enabled) {
				source.getPlayer().changeGameMode(net.minecraft.world.GameMode.CREATIVE);
				source.getPlayer().sendMessage(Text.translatable("godhand.chat.gamemode.creative"), false);
			} else {
				source.sendError(Text.translatable("godhand.chat.gamemode.creative_failed_godmode_off"));
			}
		}
		return Command.SINGLE_SUCCESS;
	}

	/**
	 * Führt den Befehl zum Rekrutieren des nächsten Begleiters aus.
	 * @param source Die Befehlsquelle.
	 * @return Command.SINGLE_SUCCESS, wenn der Befehl erfolgreich war.
	 */
	private int recruitNearestCompanionCommand(ServerCommandSource source) {
		if (source.getPlayer() != null) {
			CompanionManager.recruitNearestCompanion(source.getPlayer());
		}
		return Command.SINGLE_SUCCESS;
	}

	/**
	 * Führt den Befehl zum Freigeben aller Begleiter aus.
	 * @param source Die Befehlsquelle.
	 * @return Command.SINGLE_SUCCESS, wenn der Befehl erfolgreich war.
	 */
	private int releaseAllCompanionsCommand(ServerCommandSource source) {
		if (source.getPlayer() != null) {
			CompanionManager.releaseAllCompanions(source.getPlayer());
		}
		return Command.SINGLE_SUCCESS;
	}

	/**
	 * Führt den Befehl zum Teleportieren eines Begleiters aus.
	 * @param context Der Befehlskontext.
	 * @return Command.SINGLE_SUCCESS, wenn der Befehl erfolgreich war.
	 */
	private int teleportCompanionCommand(CommandContext<ServerCommandSource> context) {
		try {
			LivingEntity targetEntity = (LivingEntity) EntityArgumentType.getEntity(context, "entity");
			if (targetEntity instanceof PathAwareEntity pathAwareEntity) {
				CompanionManager.teleportCompanion(context.getSource().getPlayer(), pathAwareEntity);
			} else {
				context.getSource().sendError(Text.translatable("godhand.command.companion.not_a_companion"));
			}
		} catch (Exception e) {
			context.getSource().sendError(Text.translatable("godhand.command.companion.teleport_failed"));
			GodHand.LOGGER.error("Failed to teleport companion: ", e);
		}
		return Command.SINGLE_SUCCESS;
	}    /**
     * Schaltet den Super-Bogen Status für den Spieler um.
     * @param source Die Befehlsquelle.
     * @return Command.SINGLE_SUCCESS, wenn der Befehl erfolgreich war.
     */
    private int toggleSuperBowCommand(ServerCommandSource source) {
        GodHandConfig.getInstance().player.superBowEnabled = !GodHandConfig.getInstance().player.superBowEnabled;
        GodHandConfig.saveAsync(GodHandConfig.getInstance());
        if (source.getPlayer() != null) {
            ServerPlayerEntity player = source.getPlayer();
            boolean enabled = GodHandConfig.getInstance().player.superBowEnabled;

            if (enabled) {
                // Add bow and arrows
                player.getInventory().insertStack(new ItemStack(Items.BOW));
                player.getInventory().insertStack(new ItemStack(Items.ARROW, 64));
                player.sendMessage(Text.translatable("godhand.chat.superbow.enabled"), false);
            } else {
                // Remove bow and arrows
                for (int i = 0; i < player.getInventory().size(); i++) {
                    ItemStack stack = player.getInventory().getStack(i);
                    if (stack.getItem() == Items.BOW || stack.getItem() == Items.ARROW) {
                        player.getInventory().removeStack(i);
                    }
                }
                player.sendMessage(Text.translatable("godhand.chat.superbow.disabled"), false);
            }
            source.getPlayer().sendMessage(Text.translatable("godhand.chat.player.super_bow_updated", enabled ? Text.translatable("options.on") : Text.translatable("options.off")), false);
        }
        return Command.SINGLE_SUCCESS;
    }

    /**
     * Schaltet den Unverwundbarkeitsstatus für den Spieler um.
     * @param source Die Befehlsquelle.
     * @return Command.SINGLE_SUCCESS, wenn der Befehl erfolgreich war.
     */
    private int toggleInvulnerableCommand(ServerCommandSource source) {
        if (source.getPlayer() != null) {
            source.getPlayer().setInvulnerable(!source.getPlayer().isInvulnerable());
            source.getPlayer().sendMessage(Text.translatable("godhand.chat.player.invulnerable_updated", source.getPlayer().isInvulnerable() ? Text.translatable("options.on") : Text.translatable("options.off")), false);
        }
        return Command.SINGLE_SUCCESS;
    }
}
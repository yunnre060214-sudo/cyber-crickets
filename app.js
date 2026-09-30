import { decodeMatchQuery, createRouter } from "./ui/router.js";
import { ArenaStore } from "./ui/store.js";
import { createArena } from "./ui/arena.js";
import { createMatchClient } from "./runtime/match-client.js";
import { h } from "./ui/dom.js";
import { connectArenaVisuals } from "./ui/visuals.js";
import { renderAgentBook } from "./ui/agent-book.js";
import { AGENT_REGISTRY } from "./agents/registry.js";
import { openDatabase } from "./storage/database.js";
import { createRecordStore } from "./storage/records.js";
import { migrateLegacyTournaments } from "./storage/migrate.js";
import { createReplayWorkspace } from "./ui/replay.js";
import { createCompetitionController } from "./runtime/competition-jobs.js";
import { createCompetitionWorkspace } from "./ui/competition.js";
import { createExperimentController } from "./runtime/experiment-jobs.js";
import { createExperimentWorkspace } from "./ui/experiment.js";
export function bootstrap() {
  let query, store;
  try {
    query = decodeMatchQuery(location.search);
    store = new ArenaStore(query.configInput);
  } catch (e) {
    query = { speed: 1, route: "arena" };
    store = new ArenaStore();
    document.querySelector("#buildVersion").textContent =
      "链接配置无效，已使用默认设置";
  }
  const recordStore = openDatabase().then((backend) =>
    createRecordStore({ backend }),
  );
  recordStore.catch(() => {});
  let saving = Promise.resolve(),
    replay,
    router;
  const arena = createArena({
    root: document.querySelector("#arena"),
    store,
    clientFactory: createMatchClient,
    speed: query.speed,
    onCapture: (capture, id, finished, explicit) => {
      saving = saving
        .catch(() => {})
        .then(async () => {
          const records = await recordStore;
          await records.saveMatch(capture, id);
          if (explicit) {
            await replay.open(id);
            router.navigate("replay");
          }
          if (finished) await replay.refresh();
        });
      return saving;
    },
  });
  connectArenaVisuals(arena);
  replay = createReplayWorkspace({
    root: document.querySelector("#replay"),
    store: recordStore,
    onResume: async (cp) => {
      await arena.resume(cp);
      router.navigate("arena");
    },
    onImportJob: async (type, id) => {
      await (type === "experiment" ? experiment : competition).open(id);
    },
  });
  const onOpenReplay = async (id) => {
      await replay.open(id);
      router.navigate("replay");
    },
    competition = createCompetitionWorkspace({
      root: document.querySelector("#competition"),
      controller: createCompetitionController({ store: recordStore }),
      onOpenReplay,
      store: recordStore,
    }),
    experiment = createExperimentWorkspace({
      root: document.querySelector("#experiment"),
      controller: createExperimentController({ store: recordStore }),
      store: recordStore,
      onOpenReplay,
    });
  router = createRouter({
    root: document,
    routes: {
      replay: () => replay.refresh(),
      competition: () => competition.refresh(),
      experiment: () => experiment.refresh(),
    },
  });
  renderAgentBook(document.querySelector("#agents"), AGENT_REGISTRY);
  recordStore
    .then((records) => migrateLegacyTournaments(localStorage, records))
    .catch(() => {});
  router.navigate(query.route);
  return { arena, router, store, recordStore, replay, competition, experiment };
}
if (typeof document !== "undefined") bootstrap();

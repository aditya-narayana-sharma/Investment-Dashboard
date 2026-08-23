import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createNativeSatyaSpeech,
  createSatyaListenGate,
  finishSatyaListenStart,
  shouldBeginSatyaRecognition,
} from "../app/satya/speech-native.ts";
import { satyaShouldSpeak } from "../app/dashboard/satya-client.ts";

test("stop/cancel after start makes that listen generation a no-op", () => {
  const gate = createSatyaListenGate();
  const startGeneration = gate.beginStart();
  assert.equal(gate.listening, true);
  assert.equal(shouldBeginSatyaRecognition(gate, startGeneration), true);
  gate.end();
  assert.equal(gate.listening, false);
  assert.equal(shouldBeginSatyaRecognition(gate, startGeneration), false);

  const nextGeneration = gate.beginStart();
  assert.equal(shouldBeginSatyaRecognition(gate, startGeneration), false);
  assert.equal(shouldBeginSatyaRecognition(gate, nextGeneration), true);
});

test("late permission after PTT release does not begin recognition", async () => {
  const gate = createSatyaListenGate();
  const startGeneration = gate.beginStart();
  let began = false;
  let grant;
  const permission = new Promise((resolve) => {
    grant = resolve;
  });
  const finishing = finishSatyaListenStart(
    gate,
    startGeneration,
    () => {
      began = true;
    },
    permission,
  );
  gate.end();
  grant(true);
  assert.equal(await finishing, false);
  assert.equal(began, false);
  assert.equal(shouldBeginSatyaRecognition(gate, startGeneration), false);
});

test("native speech posts start then stop; late start completion is ignored", async () => {
  const gate = createSatyaListenGate();
  const posts = [];
  const api = createNativeSatyaSpeech(
    {
      postMessage(message) {
        posts.push(message);
      },
    },
    gate,
  );
  api.start();
  const startGeneration = gate.generation;
  let began = false;
  let grant;
  const permission = new Promise((resolve) => {
    grant = resolve;
  });
  const finishing = finishSatyaListenStart(
    gate,
    startGeneration,
    () => {
      began = true;
    },
    permission,
  );
  api.stop();
  grant(true);
  assert.equal(await finishing, false);
  assert.equal(began, false);
  assert.deepEqual(posts, [{ action: "start" }, { action: "stop" }]);

  api.start();
  assert.equal(shouldBeginSatyaRecognition(gate, startGeneration), false);
  assert.equal(shouldBeginSatyaRecognition(gate, gate.generation), true);
  assert.equal(posts.at(-1)?.action, "start");
});

test("native bridge invalidates in-flight start with a generation token", async () => {
  const bridge = await readFile(
    new URL("../apple-app/Shared/StratjiSatyaSpeechBridge.swift", import.meta.url),
    "utf8",
  );
  assert.match(bridge, /listenGeneration/);
  assert.match(bridge, /wantsListening/);
  assert.match(bridge, /beginRecognition\(generation:/);
  assert.match(
    bridge,
    /guard self\.wantsListening, self\.listenGeneration == generation else \{ return \}/,
  );
  assert.match(bridge, /case "cancel":/);
  assert.match(bridge, /case "voices":/);
  assert.match(bridge, /AVSpeechSynthesisVoice/);
  assert.match(bridge, /window\.satyaSpeech/);
  assert.match(bridge, /messageHandlers\.satyaSpeech|static let messageName = "satyaSpeech"/);
});

test("typed Satya send stays silent; push-to-talk may speak; errors never speak", async () => {
  assert.equal(satyaShouldSpeak({ voice: false }), false);
  assert.equal(satyaShouldSpeak({ voice: true }), true);
  assert.equal(satyaShouldSpeak({ voice: true, error: true }), false);
  assert.equal(satyaShouldSpeak({ voice: false, error: true }), false);

  const [presence, room, client] = await Promise.all([
    readFile(new URL("../app/dashboard/SatyaPresence.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/SatyaBriefingRoom.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/satya-client.ts", import.meta.url), "utf8"),
  ]);
  assert.match(presence, /submitPrompt\(text, \{ voice: true \}\)/);
  assert.match(presence, /submitPrompt\(text, \{ voice: false \}\)/);
  assert.match(presence, /submitPrompt\(prompt, \{ voice: false \}\)/);
  assert.match(presence, /satyaShouldSpeak\(\{ voice \}\)/);
  assert.doesNotMatch(presence, /onError:[\s\S]{0,180}speak\(/);
  assert.match(room, /voice = false/);
  assert.match(room, /void run\(text, options\?\.voice === true\)/);
  assert.match(room, /void run\(prompt, false\)/);
  assert.match(room, /satyaShouldSpeak\(\{ voice \}\)/);
  assert.doesNotMatch(room, /onError:[\s\S]{0,200}speak\(/);
  assert.match(client, /voice: payload\.voice === true/);
});

import { cTrack } from "./c";
import { javaTrack } from "./java";
import { pythonTrack } from "./python";
import { cppTrack } from "./cpp";
import { sqlTrack } from "./sql";
import type { Track } from "./types";

export const TRACKS: readonly Track[] = [cTrack, javaTrack, pythonTrack, cppTrack, sqlTrack];

export const findTrack = (key: string): Track | undefined => TRACKS.find((t) => t.key === key);

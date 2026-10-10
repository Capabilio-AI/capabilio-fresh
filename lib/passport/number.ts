import { randomInt } from "node:crypto";

// A passport number reads like CAP-SWIFT-FALCON-7K2Q: two words you can say out loud plus four letters/digits.
// 64 x 64 x 32^4 is about 4.3 billion numbers; the database's unique index is what makes "never twice" a guarantee, not a hope.
const TONES = ["AMBER", "ARCTIC", "AZURE", "BOLD", "BRIGHT", "BRISK", "CALM", "CEDAR", "CLEVER", "COBALT", "CORAL", "CRISP", "DAWN", "DEEP", "EAGER", "EMBER", "FERN", "FLINT", "FROSTY", "GOLDEN", "GRAND", "HAZEL", "IVORY", "JADE", "KEEN", "LUNAR", "MAPLE", "MISTY", "NOBLE", "OLIVE", "ONYX", "OPAL", "PEARL", "PINE", "PRIME", "QUICK", "RAPID", "RUBY", "SAGE", "SILVER", "SOLAR", "STEADY", "SWIFT", "TIDAL", "TEAL", "UMBER", "VIVID", "WILD", "WINTER", "ZEAL", "ASTRAL", "BRAVE", "CINDER", "DUSTY", "FABLED", "GLOSSY", "HONEST", "INKY", "LIVELY", "MIGHTY", "NIMBLE", "ORBITAL", "RADIANT"] as const;
const CREATURES = ["FALCON", "OTTER", "HERON", "LYNX", "TIGER", "PANDA", "RAVEN", "BISON", "COBRA", "CRANE", "DINGO", "EAGLE", "FINCH", "GECKO", "HAWK", "IBEX", "JAGUAR", "KOALA", "LEMUR", "MANTIS", "NARWHAL", "OSPREY", "PUMA", "QUAIL", "ROBIN", "SALMON", "TAPIR", "URIAL", "VIPER", "WOLF", "YAK", "ZEBRA", "BADGER", "CONDOR", "DOLPHIN", "FERRET", "GAZELLE", "HERMIT", "IGUANA", "KESTREL", "LOCUST", "MARTEN", "NEWT", "OCELOT", "PELICAN", "RAPTOR", "SPARROW", "TURTLE", "WALRUS", "ANTLER", "BEAVER", "CHEETAH", "DRAGON", "ELK", "FOX", "GIBBON", "HYENA", "IMPALA", "JACKAL", "KITE", "LLAMA", "MOOSE", "ORCA"] as const;
const SUFFIX_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I
const SUFFIX_LENGTH = 4;

export const PASSPORT_NUMBER_PATTERN = /^CAP-[A-Z]+-[A-Z]+-[A-HJ-NP-Z2-9]{4}$/;

export function generatePassportNumber(): string {
  const suffix = Array.from({ length: SUFFIX_LENGTH }, () => SUFFIX_ALPHABET[randomInt(SUFFIX_ALPHABET.length)]).join("");
  return `CAP-${TONES[randomInt(TONES.length)]}-${CREATURES[randomInt(CREATURES.length)]}-${suffix}`;
}

/** The two words, lower-case, as they should be spoken: "swift falcon". */
export const spokenWords = (passportNo: string): string => passportNo.split("-").slice(1, 3).join(" ").toLowerCase();

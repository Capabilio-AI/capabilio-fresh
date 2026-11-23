import { withChallenges, type Track } from "../types";
import { challenges } from "./challenges";
import { csBasics, csData } from "./m1-basics-data";
import { csOop, csModern } from "./m2-oop-modern";

export const csharpTrack: Track = {
  key: "csharp",
  title: "C#",
  runnerLanguage: "csharp",
  tagline: "Microsoft's language for .NET: enterprise software, APIs, cloud and Unity.",
  outcome: "Write clean C# with types, collections, LINQ, classes, async code and records, ready for .NET and ASP.NET Core roles.",
  references: [
    { title: "Microsoft Learn: C# documentation", url: "https://learn.microsoft.com/en-us/dotnet/csharp/" },
    { title: "Microsoft Learn: A tour of C#", url: "https://learn.microsoft.com/en-us/dotnet/csharp/tour-of-csharp/" },
    { title: ".NET documentation", url: "https://learn.microsoft.com/en-us/dotnet/" },
  ],
  modules: withChallenges([csBasics, csData, csOop, csModern], challenges),
};

import type { CrtModule } from "../model";

export type Block =
  | { type: "text"; body: string }
  | { type: "example"; title: string; body: string }
  | { type: "tip"; body: string }
  | { type: "practice"; prompt: string; options: string[]; answer: number; why: string };

export interface SessionDef {
  module: CrtModule;
  position: number;
  title: string;
  summary: string;
  minutes: number;
  content: Block[];
}

const text = (body: string): Block => ({ type: "text", body });
const example = (title: string, body: string): Block => ({ type: "example", title, body });
const tip = (body: string): Block => ({ type: "tip", body });
const practice = (prompt: string, options: string[], answer: number, why: string): Block => ({ type: "practice", prompt, options, answer, why });

export const SESSIONS: SessionDef[] = [
  {
    module: "aptitude", position: 1, title: "Percentages, profit and loss", minutes: 25,
    summary: "Turn percentage problems into one multiplication, and stop adding discounts together.",
    content: [
      text("Almost every percentage question is one idea: a percentage is a fraction of 100. Convert it to a multiplier and multiply. 20% becomes 0.2; a 20% rise becomes ×1.2; a 20% fall becomes ×0.8."),
      example("Increase then decrease", "A price goes up 20% and then down 20%. It does not return to the start. 100 × 1.2 × 0.8 = 96, so the price is 4% lower."),
      example("Profit and loss", "Profit % and loss % are always on the cost price, discount % is always on the marked price. Cost Rs 500, sold at Rs 600: profit 100, so 100/500 = 20%."),
      tip("Successive discounts multiply, they do not add. 20% off and then 10% off is ×0.8 ×0.9 = ×0.72, a 28% discount, not 30%."),
      practice("A shirt marked at Rs 800 is sold at 25% off. What is the selling price?", ["Rs 200", "Rs 600", "Rs 625", "Rs 775"], 1, "25% of 800 is 200, and 800 − 200 = 600. Or multiply: 800 × 0.75 = 600."),
      practice("Cost price Rs 400, selling price Rs 500. What is the profit percentage?", ["20%", "25%", "30%", "125%"], 1, "Profit is 100 on a cost of 400, and 100/400 = 25%."),
    ],
  },
  {
    module: "aptitude", position: 2, title: "Ratios, averages and mixtures", minutes: 25,
    summary: "Share, average and mix without equations, using totals.",
    content: [
      text("Ratios split a total into equal parts. For 2:3, there are 5 parts; one part is total ÷ 5, so the first share is 2 parts."),
      example("Averages are totals", "Average × count = total. If the average of 5 numbers is 20, the total is 100. Adding a sixth number that makes the average 22 makes the total 132, so the sixth number is 32."),
      example("Mixtures", "2 kg at Rs 30 and 3 kg at Rs 40 cost 60 + 120 = Rs 180 for 5 kg, which is Rs 36 per kg. The answer leans toward the cheaper price only if more of it is used."),
      tip("When an average changes, work with the change in totals. It is faster and avoids mistakes with fractions."),
      practice("Rs 960 is divided in the ratio 3:5. What is the larger share?", ["Rs 360", "Rs 480", "Rs 600", "Rs 640"], 2, "There are 8 parts, each Rs 120. The larger share is 5 × 120 = 600."),
      practice("The average of 4 numbers is 15. A fifth number is added and the average becomes 17. What is the fifth number?", ["19", "25", "32", "34"], 1, "New total 5 × 17 = 85, old total 4 × 15 = 60, so the fifth is 25."),
    ],
  },
  {
    module: "aptitude", position: 3, title: "Time, work and speed", minutes: 30,
    summary: "Use rates: work per day and distance per hour make hard questions easy.",
    content: [
      text("Treat every job as a rate. If A finishes in 10 days, A does 1/10 of the work per day. Together, add the rates and take the reciprocal."),
      example("Working together", "A takes 12 days and B takes 6 days. Per day: 1/12 + 1/6 = 3/12 = 1/4. Together: 4 days."),
      example("Average speed", "Going at 40 km/h and returning at 60 km/h is not 50 km/h. For the same distance, average speed = 2xy/(x+y) = 2×40×60/100 = 48 km/h."),
      tip("km/h to m/s: multiply by 5/18. 72 km/h is 20 m/s. A train crossing a pole covers its own length."),
      practice("A can do a job in 15 days and B in 10 days. Together, how many days?", ["5", "6", "12", "25"], 1, "1/15 + 1/10 = 5/30 = 1/6, so 6 days."),
      practice("A train 150 m long passes a pole in 10 seconds. Its speed in km/h?", ["15", "54", "60", "90"], 1, "150/10 = 15 m/s. 15 × 18/5 = 54 km/h."),
    ],
  },
  {
    module: "reasoning", position: 1, title: "Series and patterns", minutes: 20,
    summary: "A short checklist that cracks most number and letter series.",
    content: [
      text("Look at the gaps first. If the gaps are constant, it is arithmetic. If each term is multiplied, it is geometric. If the gaps themselves grow, look at the gaps of the gaps."),
      example("Growing gaps", "2, 3, 5, 8, 12, ?  The gaps are 1, 2, 3, 4, so the next gap is 5 and the answer is 17."),
      example("Squares", "5, 8, 13, 20, 29, ?  Each is a square plus 4: 1²+4, 2²+4, 3²+4, 4²+4, 5²+4, so the next is 6²+4 = 40."),
      tip("For letters, convert to numbers (A=1 … Z=26) and apply the same checklist."),
      practice("Find the next: 3, 6, 12, 24, ?", ["30", "36", "48", "96"], 2, "Each term doubles, so 24 × 2 = 48."),
      practice("Find the next: 1, 2, 4, 7, 11, ?", ["14", "15", "16", "18"], 2, "The gaps are 1, 2, 3, 4, so the next gap is 5 and 11 + 5 = 16."),
    ],
  },
  {
    module: "reasoning", position: 2, title: "Coding, directions and ranking", minutes: 20,
    summary: "Track position changes on paper and the answers are never hard.",
    content: [
      text("Coding-decoding questions use a rule: letters shifted by a fixed number, reversed, or replaced. Find the rule from the example and apply it to the new word."),
      example("Shift code", "If CAT becomes ECV, every letter moves 2 forward. Then DOG becomes FQI."),
      example("Directions", "Walk 5 km north, 3 km east, then 5 km south. The north and south parts cancel. You are 3 km east of the start."),
      example("Ranking", "If you are 8th from the left and 5th from the right, there are 8 + 5 − 1 = 12 people. You are counted in both."),
      tip("Always draw a small diagram for direction and seating questions. Do not try to hold it in your head."),
      practice("A is 12th from the top and 15th from the bottom in a class. How many students are there?", ["26", "27", "28", "29"], 0, "12 + 15 − 1 = 26."),
      practice("Today is Wednesday. What day is it after 10 days?", ["Friday", "Saturday", "Sunday", "Monday"], 1, "10 days is 1 week and 3 days. Wednesday + 3 = Saturday."),
    ],
  },
  {
    module: "reasoning", position: 3, title: "Syllogisms and blood relations", minutes: 25,
    summary: "Four syllogism patterns and one trick for relationship chains.",
    content: [
      text("In a syllogism you decide whether a conclusion must follow from the statements, however strange they sound. Use only the statements, never your own knowledge."),
      example("All A are B, all B are C", "Then all A are C must follow. Also, some C are A follows, because A has members."),
      example("All A are B, some B are C", "Nothing definite follows about A and C. The B's that are C may be different B's from the ones that are A."),
      example("Blood relations", "\"My mother's brother's son\": mother's brother is an uncle, and his son is a cousin. Break the chain one link at a time."),
      tip("Some means at least one. \"Some A are B\" does not say \"some A are not B\", and it does not say \"all\"."),
      practice("Statements: All pens are books. All books are tables. Conclusion: All pens are tables.", ["Follows", "Does not follow", "Cannot say", "Only partly"], 0, "All pens are books and all books are tables, so all pens are tables."),
      practice("P is the brother of Q. Q is the mother of R. How is P related to R?", ["Father", "Uncle", "Brother", "Cousin"], 1, "P is the brother of R's mother: an uncle."),
    ],
  },
  {
    module: "verbal", position: 1, title: "Grammar that interviews notice", minutes: 20,
    summary: "The handful of errors recruiters actually hear, and how to avoid them.",
    content: [
      text("You do not need all of grammar. A few rules cause most of the visible mistakes: subject-verb agreement, tenses, prepositions and word choice."),
      example("Agreement", "\"Each of the students has a laptop\" (each is singular). \"The team of engineers is ready\" (the subject is team)."),
      example("Prepositions", "Good at, interested in, depend on, senior to, since 2022 but for two years."),
      example("Common slips", "\"Informations\" is wrong: say information. \"Discuss about\" is wrong: say discuss. \"Suggest me\" is wrong: say suggest to me, or advise me."),
      tip("Speak in short sentences. Short sentences leave less room for grammar mistakes and sound confident."),
      practice("Which sentence is correct?", ["She don't know the answer.", "She doesn't knows the answer.", "She doesn't know the answer.", "She not know the answer."], 2, "Doesn't already carries the -s, so the main verb stays plain: know."),
      practice("He is interested ___ data science.", ["on", "in", "at", "with"], 1, "Interested in is the fixed phrase."),
    ],
  },
  {
    module: "verbal", position: 2, title: "Writing a professional email", minutes: 20,
    summary: "A five-line structure for any email to a professor, recruiter or colleague.",
    content: [
      text("A good professional email is short and complete. The reader should understand who you are, what you want and what to do next without needing to write back."),
      example("The structure", "1. A clear subject line. 2. Greeting with the name. 3. The purpose in one sentence. 4. The details or the ask, with any date. 5. Thanks and your name."),
      example("Before and after", "Before: \"hi sir need leave pls\". After: \"Dear Professor Rao, I would like to request leave on 14 March because of a family function. I will catch up on the missed lab session on Monday. Thank you, Anil Kumar (Roll 21CS045)\"."),
      tip("Reread once before sending: names spelled right, attachment included, no all-capitals, no text-speak."),
      practice("Which subject line is best for sending your resume to a recruiter?", ["Resume", "Hi", "Application for Data Analyst Intern: Priya Sharma", "URGENT please check"], 2, "It states the purpose, the role and who you are."),
      practice("Which closing is best?", ["bye", "Thanks and regards, Arjun Rao", "ok thanks", "Reply fast"], 1, "A formal closing thanks the reader and signs with the full name."),
    ],
  },
  {
    module: "verbal", position: 3, title: "Interviews and group discussions", minutes: 25,
    summary: "How to speak so people remember the point you made.",
    content: [
      text("In interviews and group discussions, structure beats vocabulary. Make your point first, back it with one example, and stop."),
      example("The point-reason-example pattern", "\"I prefer working in teams. It helps me catch mistakes early. In my final-year project, a teammate found a bug in my code during review and we fixed it before the demo.\""),
      example("In a group discussion", "Start with a short opening only if you are confident of the topic. Build on what others said (\"To add to Meera's point…\"). Invite quiet members in. Close with a one-line summary if there is a gap."),
      tip("If you do not know an answer, say so, then explain how you would find it. Interviewers value honesty and method over a bluff."),
      practice("An interviewer asks, \"Tell me about yourself.\" What is the best opening?", ["I was born in a small town and I have three siblings.", "I am a final-year CSE student who has built two web apps and I want to work in backend development.", "I am hardworking and sincere.", "Please see my resume."], 1, "It is short, relevant and ends with direction."),
      practice("In a group discussion, a participant keeps interrupting you. Best response?", ["Raise your voice", "Stop speaking for the day", "Politely say, \"May I finish my point?\" and continue", "Leave the discussion"], 2, "Calmly claiming your turn keeps you respectful and visible."),
    ],
  },
  {
    module: "soft_skills", position: 1, title: "Teamwork and handling conflict", minutes: 20,
    summary: "How strong teammates behave when work gets uncomfortable.",
    content: [
      text("Teams rarely fail because people lack skills. They fail because problems stay unspoken. The habits below keep problems small."),
      example("Raise it early, privately", "A teammate is late with their part. Message them: \"I noticed the module is pending. Is something blocking you? Can I help?\" Most issues end there."),
      example("Disagree with the idea, not the person", "Say \"I see a risk with this approach\" rather than \"You are wrong\". Offer your alternative and the reason."),
      tip("Once the team decides, commit fully, even if it was not your choice. Voice concerns before the decision, not after."),
      practice("A teammate has missed two deadlines. What is the best first step?", ["Tell the faculty immediately", "Do their work silently", "Talk to them privately to understand the reason and offer help", "Complain in the group chat"], 2, "Understanding the cause is the fastest way to solve it."),
      practice("Your idea was not chosen. What is the best response?", ["Work slowly on the chosen idea", "Support the decision and help make it succeed", "Keep arguing", "Leave the team"], 1, "Commitment after a decision is what makes teams work."),
    ],
  },
  {
    module: "soft_skills", position: 2, title: "Time management and ownership", minutes: 20,
    summary: "Plan the week, protect your focus, and own your mistakes.",
    content: [
      text("Time management is choosing what to do first. Ownership is finishing what you said you would, and speaking up early when you cannot."),
      example("The weekly plan", "List every task with its deadline and effort. Start with the one that is both urgent and large. Block two focused hours a day with the phone away."),
      example("Owning a mistake", "\"I found an error in the report I sent yesterday. Here is the corrected version, and I have added a check so it does not happen again.\" Short, specific and calm."),
      tip("Tell people about a delay when you first see it, not on the deadline. Early bad news can be fixed; late bad news cannot."),
      practice("You have three tasks due this week and have not started. What do you do first?", ["Do the easiest", "Sort them by deadline and size and start the most urgent", "Ask for extensions on all", "Wait for motivation"], 1, "A quick plan beats guesswork."),
      practice("You notice you will miss a deadline. What is the best action?", ["Say nothing until it passes", "Tell the person now, explain why and give a new date", "Blame someone else", "Submit incomplete work without telling"], 1, "Early, honest communication preserves trust."),
    ],
  },
  {
    module: "soft_skills", position: 3, title: "Interview conduct and workplace etiquette", minutes: 20,
    summary: "The small habits that decide first impressions.",
    content: [
      text("Recruiters notice conduct as much as answers: punctuality, how you listen, how you handle not knowing, and how you treat everyone you meet."),
      example("Punctuality", "Arrive 15 minutes early. If you will be late, message the recruiter as soon as you know, with a new time."),
      example("Listening", "Pause for a second before answering. Look at the person speaking. If you did not catch a question, ask them to repeat it."),
      example("Integrity", "Never claim a skill you do not have, share another company's confidential details, or copy work. Offering to learn is always better than a bluff."),
      tip("Thank the interviewer, and the receptionist. Follow up with a short thank-you email within a day."),
      practice("You do not know the answer to a technical question. What is best?", ["Guess confidently", "Say you do not know, then explain how you would find out", "Stay silent", "Change the subject"], 1, "Honesty with a method shows how you work."),
      practice("A friend asks you to share your lab record so they can copy it. Best response?", ["Share it", "Say no and avoid them", "Offer to explain the concepts so they can write their own", "Sell it"], 2, "You help them learn without breaking integrity."),
    ],
  },
];

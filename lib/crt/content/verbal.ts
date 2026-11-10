import { layout, rng, type BankRow, type Draft } from "./draft";

// [topic, prompt, right answer, three wrong answers, why]. Written by hand: the wrong options are the mistakes students really make.
type Item = readonly [string, string, string, string, string, string, string];

const G = "Grammar";
const V = "Vocabulary";
const W = "Workplace Writing";
const S = "Spoken Communication";

const ITEMS: readonly Item[] = [
  [G, "Choose the correct sentence to complete: She ___ to the office every day.", "goes", "go", "going", "gone", "A singular subject (she) takes the -s form in the present tense."],
  [G, "Neither the manager nor the engineers ___ present at the meeting.", "were", "was", "is", "has been", "With neither/nor the verb agrees with the nearer subject, engineers, which is plural."],
  [G, "He has been working here ___ 2022.", "since", "for", "from", "during", "Use since with a point in time and for with a length of time."],
  [G, "Choose the correct sentence about a team and its report.", "The team has submitted its report.", "The team have submitted it's report.", "The team has submitted it's report.", "The team have submitted their's report.", "Team is treated as one unit here, and its (no apostrophe) is the possessive."],
  [G, "I look forward to ___ you at the interview.", "meeting", "meet", "met", "have met", "After the preposition to in look forward to, use the -ing form."],
  [G, "Each of the candidates ___ asked to bring an ID proof.", "was", "were", "have been", "are", "Each takes a singular verb."],
  [G, "If I ___ you, I would prepare the presentation again.", "were", "was", "am", "will be", "The second conditional uses were for an imagined situation, even with I."],
  [G, "She is senior ___ me in the company.", "to", "than", "from", "over", "Senior, junior, superior and inferior take to, not than."],
  [G, "Choose the correctly punctuated sentence.", "However, the results were not final.", "However the results, were not final.", "However; the results were not final.", "However the results were, not final.", "A sentence-opening however is followed by a comma."],
  [G, "He did not know ___ the meeting had been cancelled.", "that", "what", "which", "whom", "That introduces the clause that states the fact."],
  [G, "Spot the error: The informations given in the brochure are accurate.", "informations", "given", "brochure", "accurate", "Information is uncountable and has no plural form."],
  [G, "Spot the error: She suggested me to apply for the internship.", "suggested me to apply", "She", "for the", "internship", "Suggest does not take an object plus to. Say: suggested that I apply, or advised me to apply."],
  [G, "Choose the correct passive form of: The committee approved the plan.", "The plan was approved by the committee.", "The plan is approved by the committee.", "The plan has approving by the committee.", "The plan were approved by the committee.", "Past simple active becomes was/were plus the past participle."],
  [V, "Choose the word closest in meaning to MEAGRE.", "Scanty", "Plentiful", "Generous", "Lavish", "Meagre means small in amount; scanty is its closest match."],
  [V, "Choose the word opposite in meaning to CANDID.", "Evasive", "Frank", "Honest", "Open", "Candid means direct and honest; evasive avoids a direct answer."],
  [V, "Choose the word closest in meaning to DILIGENT.", "Hardworking", "Careless", "Lazy", "Hesitant", "A diligent person works with steady care."],
  [V, "Choose the word opposite in meaning to EXPAND.", "Contract", "Extend", "Enlarge", "Stretch", "To contract is to become smaller."],
  [V, "One word for: a person who speaks several languages.", "Polyglot", "Linguist", "Orator", "Interpreter", "A polyglot knows many languages. A linguist studies language itself."],
  [V, "One word for: the study of how people behave in groups.", "Sociology", "Psychology", "Philosophy", "Anthropology", "Sociology studies groups and society."],
  [V, "Choose the word closest in meaning to PRUDENT.", "Wise and careful", "Rash", "Wasteful", "Stubborn", "Prudent means acting with care for the future."],
  [V, "Fill in the blank: His ___ remarks upset the whole team.", "tactless", "tactful", "gracious", "courteous", "Only tactless fits an effect of upsetting people."],
  [V, "Choose the word opposite in meaning to ABUNDANT.", "Scarce", "Ample", "Copious", "Rich", "Abundant means plentiful; scarce means hard to find."],
  [V, "Fill in the blank: The new policy will ___ the process and save time.", "streamline", "complicate", "obstruct", "prolong", "Streamline means to make simpler and quicker."],
  [V, "Choose the word closest in meaning to REITERATE.", "Repeat", "Reject", "Revise", "Resolve", "To reiterate is to say again."],
  [V, "Fill in the blank: She was ___ about the offer, so she asked for a week to decide.", "undecided", "certain", "delighted", "indifferent", "Asking for time to decide shows she was undecided."],
  [W, "You are emailing your professor for an extension. Which opening is the most professional?", "Dear Professor Rao, I am writing to request a short extension for the assignment due on Friday.", "hey sir, need more time for the assignment, pls extend.", "Sir!!! Please give extension urgently.", "Professor, extension. Thanks.", "A professional email names the person, states the purpose and the detail in a polite, complete sentence."],
  [W, "Which subject line is best for an email applying for an internship?", "Application for Software Internship: Priya Sharma, B.Tech CSE", "Hello", "Urgent!!!", "Please read this", "A good subject line says what the email is and who it is from."],
  [W, "Which closing is most suitable for a formal email?", "Thank you for your time. Kind regards, Arjun", "bye, Arjun", "Ok thanks bye", "Waiting for reply asap", "Formal emails close with thanks and a polite sign-off."],
  [W, "A colleague's email has an unclear request. What is the best reply?", "Thanks for your message. Could you confirm which report you need and by when?", "I did not understand your mail.", "Please write properly next time.", "Ignore it until they ask again.", "Asking a specific, polite question moves the work forward."],
  [W, "You will be late to a meeting by 15 minutes. What do you write?", "I am running about 15 minutes late. Please start without me, and I will join as soon as I arrive.", "I will come when I come.", "Traffic. Late.", "Sorry!!! Do not start anything!!!", "Say how late, what you suggest and when you will join."],
  [W, "Which version of this sentence is most concise? \"Due to the fact that it was raining, the event was cancelled.\"", "The event was cancelled because of rain.", "Due to the fact that rain was falling, it was the case that the event was cancelled.", "The event, because of the fact of rain, got cancelled.", "It rained and the event, it was cancelled.", "Because of replaces due to the fact that and cuts the extra words."],
  [W, "In a professional chat message, which is the best way to ask for help?", "Hi Neha, could you spare 10 minutes today to review my code? I am stuck on the login bug.", "Help.", "Need help urgently!!! Reply now!!!", "Anyone? Anyone??", "Be specific about the ask, the time and the problem."],
  [W, "Which line best belongs in a resume summary for a fresher?", "Final-year CSE student with two web projects and hands-on experience in React and SQL.", "I am a hardworking and sincere person who wants a good job.", "Looking for any job in any company.", "Eager to learn and give my best always.", "Concrete skills and projects are better evidence than general claims."],
  [S, "In an interview you are asked, \"Tell me about yourself.\" What is the best approach?", "Give a short summary: your background, a key project or skill, and what you want next.", "Read your resume aloud word for word.", "Say \"nothing special\" to appear humble.", "Speak about your family and hobbies in detail.", "A focused one-minute summary shows clear thinking and relevance."],
  [S, "You did not hear a question clearly in an interview. What should you do?", "Politely ask the interviewer to repeat or rephrase it.", "Guess and answer anyway.", "Stay silent until they move on.", "Say the question is unclear.", "Asking is a sign of care, not weakness."],
  [S, "In a group discussion, another participant is dominating. What is the best response?", "Wait for a pause, acknowledge their point, then add your own with a fresh angle.", "Interrupt loudly until they stop.", "Stay quiet for the whole discussion.", "Argue with everything they say.", "Building on others while contributing keeps you visible and respectful."],
  [S, "How should you answer, \"What is your biggest weakness?\"", "Name a real, minor weakness and what you are doing to improve it.", "Say you have no weaknesses.", "Say you work too hard.", "Say you do not like to answer.", "Honesty with a plan to improve shows self-awareness."],
  [S, "You disagree with a point made in a meeting. What is the most professional way to say so?", "I see it differently. Could I share another view, based on the numbers I have?", "That is wrong.", "You have not understood the problem.", "Say nothing now and complain later.", "Disagree with the idea, not the person, and offer your reasoning."],
  [S, "When presenting your project, what should come first?", "What problem it solves and for whom.", "Every line of code you wrote.", "An apology that it is not perfect.", "The list of tools, in alphabetical order.", "A listener needs the purpose before the detail."],
  [S, "Which is the best way to end a phone call with a recruiter?", "Thank them for their time and confirm the next step and date.", "Hang up as soon as they stop speaking.", "Ask them to call you back later.", "Say bye without confirming anything.", "Confirming next steps leaves no confusion."],
  [G, "Choose the correct sentence about two people.", "Between you and me, the plan is risky.", "Between you and I, the plan is risky.", "Between you and myself, the plan are risky.", "Among you and me, the plan is risky.", "After a preposition use the object form me, and between is for two people."],
  [G, "Fill in the blank: She is good ___ mathematics.", "at", "in", "on", "with", "Good at is the fixed phrase for a skill."],
  [G, "Choose the correct sentence about a finished task.", "I have finished my work already.", "I finished my work yesterday already.", "I am finishing my work yesterday.", "I have finished my work yesterday.", "The present perfect is used without a finished time like yesterday; with already it fits the first sentence."],
  [V, "Choose the word that best completes: The company's growth was ___ to its focus on customers.", "attributed", "contributed", "distributed", "subtracted", "Attributed to means credited to."],
  [V, "Choose the word opposite in meaning to TRANSPARENT (about a process).", "Opaque", "Clear", "Visible", "Open", "An opaque process hides how decisions are made."],
  [V, "Choose the word closest in meaning to INITIATIVE.", "Willingness to act without being told", "Strict obedience", "Waiting for orders", "Fear of risk", "Initiative is acting on your own accord."],
  [W, "Which sentence is the clearest?", "Please send the signed form to the placement office by 5 pm on Monday.", "The form, which needs signing, is to be sent at some point to the office.", "Form for the office, signed, Monday maybe.", "The office wants forms, and so Monday.", "Clear writing says what, to whom and by when."],
  [W, "You must decline a task because you are over-committed. What is the best message?", "I am fully booked this week, so I cannot take this on. I could help next Tuesday, or suggest someone else.", "I cannot do it.", "Why do you always ask me?", "Okay.", "Declining with a reason and an alternative keeps the relationship good."],
];

export function verbalBank(): BankRow[] {
  const r = rng(3000);
  return ITEMS.flatMap(([topic, prompt, correct, w1, w2, w3, explanation]) => {
    const d: Draft = { topic, difficulty: topic === W || topic === S ? 2 : 1, prompt, correct, wrongs: [w1, w2, w3], explanation };
    const row = layout(r, "verbal", d);
    return row ? [row] : [];
  });
}

// DEMO DATA. Completed AI interview sessions for a demo student: questions, the answers given, a score per skill, strengths and improvements.
// Scores rise from the first session to the last, as a student who practises would see.
import { randomUUID } from "node:crypto";

type Db = any;
const DAY = 864e5;

interface Session {
  mode: "technical" | "behavioral" | "hr" | "practice";
  daysAgo: number;
  score: number;
  skills: Record<string, number>;
  strengths: string[];
  improvements: string[];
  turns: { question: string; answer: string }[];
}

const BANK: Record<"data-scientist" | "ai-ml-engineer", Session[]> = {
  "data-scientist": [
    {
      mode: "practice", daysAgo: 71, score: 61, skills: { "Communication": 64, "Statistics": 58, "Python": 62 },
      strengths: ["Answers were structured and easy to follow", "Used a concrete example when asked about a project"],
      improvements: ["Give the number or result of the project, not only what was built", "Explain the reason for a method before naming it"],
      turns: [
        { question: "Tell me about a data project you are proud of.", answer: "I built a model that predicts whether a customer will leave a telecom service. I cleaned the data, handled missing values, and compared logistic regression with a random forest. The forest was better, but I kept the simpler model as a baseline." },
        { question: "How do you handle missing values?", answer: "First I check how much is missing and whether it is random. For a few values I use the median, for categories a separate 'unknown' value. If a column is mostly empty I drop it." },
        { question: "What is the difference between precision and recall?", answer: "Precision is how many of the cases I flagged were correct. Recall is how many of the real cases I found. Which one matters depends on the cost of each mistake." },
        { question: "How would you explain a p-value to a manager?", answer: "It tells how surprising the result would be if there was really no effect. A small value means the result is unlikely to be just chance." },
        { question: "What would you do if your model performs well in testing but badly in production?", answer: "I would check for leakage first, then whether the production data looks different from the training data." },
        { question: "Why do you want to work as a data scientist?", answer: "I like turning messy data into a decision someone can act on, and I enjoy explaining the result in simple words." },
      ],
    },
    {
      mode: "technical", daysAgo: 49, score: 70, skills: { "Machine Learning": 72, "Statistics": 69, "Python": 71, "Model Evaluation and Metrics": 68 },
      strengths: ["Correctly separated training, validation and test data and said why", "Chose the evaluation metric from the business cost"],
      improvements: ["Mention regularisation when discussing overfitting", "Give the formula or intuition for the metric, not only its name"],
      turns: [
        { question: "Explain the bias-variance trade-off.", answer: "A simple model has high bias: it misses patterns. A complex model has high variance: it fits noise and does badly on new data. I look at training and validation error together, and add data, regularisation or simplify the model depending on which side I am on." },
        { question: "How would you choose between logistic regression and gradient boosting for a churn model?", answer: "I start with logistic regression because it is fast and explainable. If gradient boosting gives a clearly better validation score on the same split, and the team can monitor it, I would use it. Otherwise the simpler model is easier to run." },
        { question: "A dataset has 2% positives. How do you evaluate a classifier?", answer: "Accuracy would be misleading, a model that predicts all negatives is 98% accurate. I use precision, recall, the PR curve and choose a threshold from the cost of the two mistakes." },
        { question: "What is data leakage and how do you prevent it?", answer: "Using information that would not exist at prediction time. I split before any fitting, fit scalers on the training data only, and remove columns that are recorded after the outcome." },
        { question: "How do you do cross-validation on time-ordered data?", answer: "A normal shuffle would let the model see the future. I use a forward-chaining split: train on earlier periods and test on the next one." },
        { question: "Write the idea of a SQL query for the top 3 customers by revenue per region.", answer: "Group by region and customer to sum revenue, then use a window function, rank over partition by region ordered by revenue descending, and keep ranks up to 3." },
      ],
    },
    {
      mode: "behavioral", daysAgo: 27, score: 76, skills: { "Communication": 80, "Data Storytelling": 77, "Teamwork": 72 },
      strengths: ["Used the STAR structure naturally", "Described the effect of the work in numbers", "Took responsibility for a mistake and said what changed afterwards"],
      improvements: ["Spend less time on the situation and more on the action taken"],
      turns: [
        { question: "Tell me about a time a teammate disagreed with your analysis.", answer: "In a class project my teammate thought a feature was leaking the target. I checked and he was right: it was recorded after the outcome. We removed it, the score dropped from 0.97 to 0.78, and the result became believable. I now run a leakage check at the start of every project." },
        { question: "Describe a time you had to explain a technical result to a non-technical person.", answer: "I presented churn results to a mock business panel. I led with the decision, which segment to target first, used one chart, and kept the method for questions. They approved the plan in two minutes." },
        { question: "Tell me about a deadline you nearly missed.", answer: "I underestimated the cleaning time on a dataset. I told my team early, cut one planned model, and delivered the baseline with a clear note on what was left. Since then I add a buffer for data cleaning." },
        { question: "How do you prioritise when you have several tasks?", answer: "I ask which one unblocks others or has the nearest deadline, do that first, and tell people what will wait and why." },
        { question: "Tell me about something you learned on your own.", answer: "I learned experiment design from a course and applied it by calculating the sample size for a campus survey, which changed how we collected responses." },
        { question: "What feedback have you received and what did you do?", answer: "I was told my charts had too much on them. I started using one message per chart, and my last two reviews said they were clearer." },
      ],
    },
    {
      mode: "hr", daysAgo: 9, score: 81, skills: { "Communication": 83, "Motivation": 80, "Self-awareness": 79 },
      strengths: ["Clear, honest answers with no exaggeration", "Connected past projects to the role being applied for", "Asked a thoughtful question about the team"],
      improvements: ["Prepare a shorter two-minute version of the introduction"],
      turns: [
        { question: "Tell me about yourself.", answer: "I am a final-year computer science student who focuses on data science. Over the last year I completed Arena tickets on modelling, evaluation and experiment design, and I can show the work and the explanations behind it." },
        { question: "Why should we hire you?", answer: "I can show what I have done, not only what I claim: my tasks are graded and I explain my reasoning. I am quick to learn and I communicate results in plain words." },
        { question: "What are your strengths and weaknesses?", answer: "A strength is checking my work for leakage and basic errors before sharing it. A weakness is that I sometimes spend too long polishing. I now set a time limit for each step." },
        { question: "Where do you see yourself in five years?", answer: "Leading analyses that change a business decision, and mentoring newer analysts. First I want to learn how a real team ships models." },
        { question: "Are you comfortable relocating or working in shifts?", answer: "Yes, I am open to relocation, and I would like to know the team's working pattern so I can plan." },
        { question: "Do you have any questions for us?", answer: "How does the team check that a model still works after it is deployed, and who owns that?" },
      ],
    },
  ],
  "ai-ml-engineer": [
    {
      mode: "practice", daysAgo: 69, score: 60, skills: { "Communication": 62, "Machine Learning": 61, "Python": 63 },
      strengths: ["Described the project clearly from data to result", "Knew the difference between training and test data"],
      improvements: ["Quote the actual metric from the project", "Slow down and finish each explanation"],
      turns: [
        { question: "Tell me about a machine learning project you built.", answer: "I trained an image classifier for plant leaf diseases. I used transfer learning from a pretrained model because I had only a few thousand images, and used augmentation to reduce overfitting." },
        { question: "What is overfitting?", answer: "When a model learns the training data too well, including noise, so it does badly on new data. Validation error rising while training error falls is the sign." },
        { question: "How do you split your data?", answer: "Train, validation and test. I tune on validation and look at the test set only once at the end." },
        { question: "What is a learning rate?", answer: "The size of the step the optimiser takes. Too large and it overshoots, too small and training is slow." },
        { question: "What is a confusion matrix?", answer: "A table of true and predicted classes. It shows which kinds of mistakes the model makes." },
        { question: "Why do you want to work in AI/ML?", answer: "I like building systems that learn from data and seeing them work in a real product." },
      ],
    },
    {
      mode: "technical", daysAgo: 47, score: 71, skills: { "Machine Learning": 73, "Python": 72, "Model Deployment Basics": 66, "Neural Network Fundamentals": 70 },
      strengths: ["Explained regularisation and early stopping together with when to use each", "Mentioned monitoring after deployment without being asked"],
      improvements: ["Be more precise on how batch normalisation works", "Give a number for expected latency when describing serving"],
      turns: [
        { question: "How does backpropagation work?", answer: "The network makes a prediction, the loss is computed, and gradients of the loss with respect to each weight are computed backwards with the chain rule. The optimiser then updates the weights." },
        { question: "How do you stop a neural network from overfitting?", answer: "More data and augmentation, dropout, weight decay, a smaller model, and early stopping on validation loss." },
        { question: "How would you deploy a trained model?", answer: "Save the preprocessing and the model together in one pipeline, serve it behind an API with input validation, return the model version, and log requests so I can monitor drift." },
        { question: "What is the difference between L1 and L2 regularisation?", answer: "L1 pushes some weights exactly to zero, which gives sparse models. L2 shrinks all weights smoothly. I use L2 by default and L1 when I want feature selection." },
        { question: "How do you know when to retrain a model?", answer: "I watch input drift and, when labels arrive, the real metric. If performance drops below an agreed level I retrain." },
        { question: "Why use a validation set as well as a test set?", answer: "Tuning on the test set would make its score optimistic. The validation set is for choices and the test set is the final check." },
      ],
    },
    {
      mode: "behavioral", daysAgo: 26, score: 75, skills: { "Communication": 78, "Teamwork": 74, "Problem solving": 76 },
      strengths: ["Gave specific examples with a clear result", "Showed ownership when something went wrong"],
      improvements: ["Say what you would do differently, not only what happened"],
      turns: [
        { question: "Tell me about a time a model did not work as expected.", answer: "My classifier scored 0.99 in testing. I suspected leakage, found the scaler was fitted on all the data, fixed the split, and the honest score was 0.74. I added a check for this to my template." },
        { question: "Describe a disagreement in a team project.", answer: "We disagreed on using a large model. I proposed a fair comparison on the same split. The small model was almost as good and much easier to deploy, so we chose it." },
        { question: "How do you handle unclear requirements?", answer: "I write down my understanding, ask one or two specific questions, and confirm what 'done' means before building." },
        { question: "Tell me about a deadline you managed.", answer: "For a hackathon I built a baseline in the first hour so there was always something to demo, then improved it in steps." },
        { question: "What do you do when you are stuck?", answer: "I shrink the problem to the smallest case that fails, search for it, and ask a teammate if I am still stuck after an hour." },
        { question: "What is a skill you are improving?", answer: "Writing code that others can maintain: tests, clear names and a README." },
      ],
    },
    {
      mode: "hr", daysAgo: 8, score: 80, skills: { "Communication": 82, "Motivation": 80, "Self-awareness": 78 },
      strengths: ["Confident and honest about strengths and limits", "Tied motivation to concrete work already done"],
      improvements: ["Shorten the opening introduction"],
      turns: [
        { question: "Tell me about yourself.", answer: "I am a final-year computer science student focused on machine learning engineering. I have worked through graded Arena tickets on training, evaluation, deployment and monitoring, and each one has my explanation attached." },
        { question: "Why this role?", answer: "I enjoy the full path from data to a model that is running reliably, not only the notebook." },
        { question: "What is your biggest weakness?", answer: "I sometimes try to optimise before measuring. I now write the baseline and the metric first." },
        { question: "How do you keep learning?", answer: "I pick one topic a month, build something small with it, and write down what I learned." },
        { question: "Are you open to relocating?", answer: "Yes, I am flexible and would like to understand the team and the work first." },
        { question: "Do you have questions for us?", answer: "How does the team decide when a model is ready for production, and what does monitoring look like?" },
      ],
    },
  ],
};

/** Replaces the student's demo interviews with the four above. */
export async function seedInterviews(db: Db, userId: string, roleKey: "data-scientist" | "ai-ml-engineer", roleName: string): Promise<number> {
  await db.from("ai_interview_sessions").delete().eq("user_id", userId);
  const now = Date.now();
  const rows = BANK[roleKey].map((s) => {
    const completed = new Date(now - s.daysAgo * DAY);
    const started = new Date(completed.getTime() - (24 + Math.round(s.score / 4)) * 60e3);
    return {
      id: randomUUID(), user_id: userId, mode: s.mode, status: "completed", role_target: roleName, domain: "Data & AI", questions: s.turns.map((t) => t.question), transcript: s.turns,
      overall_score: s.score, skill_scores: s.skills, strengths: s.strengths, improvements: s.improvements, started_at: started.toISOString(), completed_at: completed.toISOString(), created_at: started.toISOString(),
    };
  });
  const { error } = await db.from("ai_interview_sessions").insert(rows);
  if (error) throw error;
  return rows.length;
}

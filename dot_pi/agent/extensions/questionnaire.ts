import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const optionSchema = Type.Object({
	value: Type.String({ description: "The value returned for this option" }),
	label: Type.String({ description: "The option shown to the user" }),
	description: Type.Optional(Type.String({ description: "Optional explanation" })),
});

const questionSchema = Type.Object({
	id: Type.String({ description: "Stable identifier for the answer" }),
	prompt: Type.String({ description: "Question shown to the user" }),
	options: Type.Array(optionSchema),
	allowOther: Type.Optional(Type.Boolean({ description: "Allow a free-form answer" })),
});

function result(answers: unknown[], cancelled: boolean, text: string) {
	return {
		content: [{ type: "text" as const, text }],
		details: { answers, cancelled },
	};
}

export default function questionnaire(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "questionnaire",
		label: "Questionnaire",
		description: "Ask the user clarifying or decision questions instead of guessing.",
		parameters: Type.Object({ questions: Type.Array(questionSchema) }),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			if (!ctx.hasUI) return result([], true, "Cannot ask questions without an interactive UI.");
			if (params.questions.length === 0) return result([], true, "No questions were supplied.");

			const answers: Array<{ id: string; value: string; label: string; custom: boolean }> = [];

			for (const question of params.questions) {
				if (question.options.length === 0 && question.allowOther === false) {
					return result(answers, true, `Question ${question.id} has no answer options.`);
				}

				const otherLabel = "Other (type a response)";
				const choices = question.options.map((option) =>
					option.description ? `${option.label} — ${option.description}` : option.label,
				);
				if (question.allowOther !== false) choices.push(otherLabel);

				const selected = await ctx.ui.select(question.prompt, choices);
				if (selected === undefined) return result(answers, true, "User cancelled the questionnaire.");

				if (selected === otherLabel) {
					const value = await ctx.ui.input(`${question.prompt} (type your answer)`);
					if (value === undefined) return result(answers, true, "User cancelled the questionnaire.");
					answers.push({ id: question.id, value: value.trim(), label: value.trim(), custom: true });
					continue;
				}

				const index = choices.indexOf(selected);
				const option = question.options[index];
				if (!option) return result(answers, true, `Could not resolve the answer for ${question.id}.`);
				answers.push({ id: question.id, value: option.value, label: option.label, custom: false });
			}

			return result(
				answers,
				false,
				answers.map((answer) => `${answer.id}: ${answer.value}`).join("\n"),
			);
		},
	});
}

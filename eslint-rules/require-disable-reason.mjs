const DIRECTIVE = /^eslint-disable(-next-line|-line)?(\s|$)/;
const REASON = /\s-{2,}\s*\S/;

// ESLint core cannot require a reason on a disable directive: this rule does.
export default {
  meta: {
    type: 'problem',
    schema: [],
    messages: { missing: 'State why after " -- " in this eslint-disable comment.' },
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          const text = comment.value.trim();
          if (DIRECTIVE.test(text) && !REASON.test(text)) {
            context.report({ loc: comment.loc, messageId: 'missing' });
          }
        }
      },
    };
  },
};

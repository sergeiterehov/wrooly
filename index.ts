const rulesDefinitions = {
    WhiteSpace: /\s+/,
    Id: /[a-zA-Z_]+[a-zA-Z_0-9]*/,
    LPar: /\(/,
    RPar: /\)/,
    FuncBodyStart: /\-\>/,
    Number: /\d+(\.\d+)?/,
    Plus: /\+/,
    Minus: /\-/,
    Pow: /\*\*/,
    Mul: /\*/,
    Div: /\//,
    Delimiter: /;/,
    String: /"(\\"|[^"])*"/
};

const rules = Object
    .entries(rulesDefinitions)
    .map(([type, definition]) => ({ type, definition }));

type Token = {
    type: string;
    value: string;
}

let tokens: Token[] = [];

let input = `
func(x) -> 23 * x ** 2 - 456 * x + 89;

"Answer is " + func(func(2) + 4);
`;

let pointer = 0;

for (let limit = input.length; limit; limit -= 1) {
    if (!input.length) break;

    let found = false;

    for (let ruleIndex = 0; ruleIndex < rules.length; ruleIndex += 1) {
        const { type, definition } = rules[ruleIndex];

        const match = definition.exec(input);

        if (!match) continue;

        if (match.index) continue;

        tokens.push({ type, value: match[0] });

        pointer += match[0].length;
        input = input.substr(match[0].length);
        found = true;
    }

    if (!found) break;
}

tokens = tokens.filter(t => t.type !== "WhiteSpace");
console.log(tokens);

const $id = (args: any[]) => args[0];
const $value = (args: any[]) => args[0].value;

const expressionsDefinitions: Array<[
    string,
    string[],
    (args: any[])=> any,
] | [
    string,
    string[],
]> = [
    ["File", ["Expression", "#Delimiter", "File"], ({0:exp,2:exps}) => [exp, ...exps]],
    ["File", ["Expression", "#Delimiter"], ({0:exp}) => [exp]],
    ["Expression", ["FunctionDefinition"], $id],
    ["Expression", ["Math"], $id],
    ["FunctionDefinition", ["#Id", "#LPar", "FunctionArgs", "#RPar", "#FuncBodyStart", "Math"], ({0:{value:name},2:args,5:exp}) => ({$:"def", name, args, exp})],
    ["FunctionArgs", ["#Id"]],
    ["Math", ["Sum"], $id],
    ["Sum", ["Mul", "#Plus", "Sum"], ({0:left,2:right}) => ({$:"plus", left, right})],
    ["Sum", ["Mul", "#Minus", "Sum"], ({0:left,2:right}) => ({$:"minus", left, right})],
    ["Sum", ["Mul"], $id],
    ["Mul", ["Pow", "#Mul", "Mul"], ({0:left,2:right}) => ({$:"mul", left, right})],
    ["Mul", ["Pow", "#Div", "Mul"], ({0:left,2:right}) => ({$:"div", left, right})],
    ["Mul", ["Pow"], $id],
    ["Pow", ["Atom", "#Pow", "Pow"], ({0:left,2:right}) => ({$:"pow", left, right})],
    ["Pow", ["Atom"], $id],
    ["Atom", ["#Id"], $value],
    ["Atom", ["#Number"], $value],
    ["Atom", ["#String"], $value],
    ["Atom", ["Invoke"], $id],
    ["Atom", ["#LPar", "Math", "#RPar"], ({1:id}) => id],
    ["Invoke", ["#Id", "#Lpar", "Math", "#RPar"], ({0:{value:name},2:arg}) => ({$:"invoke", name, args: [arg]})]
];

type Expression = {
    type: string;
    elements: string[];
    post?(args: any[]): any;
}

const expressions = expressionsDefinitions.map(([type, elements, post]) => ({ type, elements, post }));

type Result = {
    expression: Expression;
    objects: Array<Token | Result>;
}

type Context = {
    type: string;
    _token: number;
    _tokenInitial: number;
    _expression: number;
    _element: number;
    ctxChild?: Context;
    elements: Result["objects"];
    result: Result[];
};

function createState(base: Partial<Context>): Context {
    return {
        type: "_",
        _token: 0,
        _tokenInitial: 0,
        _expression: 0,
        _element: 0,
        ...base,
        elements: [],
        result: [],
    };
}

const ctxInitial = createState({ type: expressions[0].type });
const stack = [ctxInitial];

$$getTokens: for (let limit = 10000000; limit; limit -= 1) {
    const ctx = stack[stack.length - 1];

    if (!ctx) break;

    $$search: for (; ctx._expression < expressions.length; ctx._expression += 1) {
        const expression = expressions[ctx._expression];
        const { type, elements } = expression;

        if (type !== ctx.type) continue;

        for (; ctx._element < elements.length; ctx._element += 1) {
            const element = elements[ctx._element];
            const token = tokens[ctx._token];

            console.log(ctx)

            if (element[0] === "#") {
                if ("#" + token.type !== element) {
                    ctx.elements = [];
                    ctx._element = 0;
                    ctx._token = ctx._tokenInitial;

                    continue $$search;
                }

                ctx.elements.push(token);
                ctx._token += 1;
            } else {
                const ctxChild = ctx.ctxChild;

                if (!ctxChild) {
                    ctx.ctxChild = createState({
                        type: element,
                        _token: ctx._token,
                        _tokenInitial: ctx._token
                    });

                    stack.push(ctx.ctxChild);
                    console.log("getTokens PUSH");

                    continue $$getTokens;
                } else {
                    ctx.ctxChild = undefined;
                }

                const childTokens = ctxChild.result;

                if (!childTokens.length) {
                    ctx.elements = [];
                    ctx._element = 0;
                    ctx._token = ctx._tokenInitial;

                    continue $$search;
                }

                ctx.elements.push(childTokens[0]); // TODO: ambiguous
                ctx._token = ctxChild._token;
            }
        }

        if (ctx.elements.length === elements.length) {
            ctx.result = [{ expression, objects: ctx.elements }];

            break;
        }

        ctx._element = 0;
        ctx._token = ctx._tokenInitial;
    }

    stack.pop();
    console.log("getTokens POP", ctx);
}

const processingStack: Result[] = [];
const objects: Result[] = [...ctxInitial.result]

for (let limit = 1000000; limit; limit -= 1) {
    const obj = objects.pop();

    if (!obj) break;

    processingStack.unshift(obj);

    obj.objects
        .filter((child): child is Result => child.hasOwnProperty("objects"))
        .forEach((child) => objects.push(child));
}

console.log("OBJECTS:", JSON.stringify(ctxInitial.result));

console.log("CALL_STACK:", processingStack.map((obj) => obj.expression.type));

processingStack.forEach((result) => {
    if (!result.expression.post) return;

    result.objects = result.expression.post(result.objects);
    console.log(result.expression.type, result.objects)
});

console.log("RESULT:", JSON.stringify(ctxInitial.result));
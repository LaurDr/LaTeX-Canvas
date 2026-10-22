// A template is the LaTeX inserted when a palette button is clicked.
// `#` marks an empty slot: it is removed on insert, the first slot receives
// the current selection (if any) and the cursor lands in the next free slot.
// `#` is the macro-parameter character in TeX, so it never appears in a real
// equation body and is safe to use as a marker.
export const SLOT = '#';

export interface MathTemplate {
	label: string;
	latex: string;
	// What empty slots are filled with. Defaults to `\square`, which only
	// exists in math mode, so text-mode slots need plain text instead.
	placeholder?: string;
}

export interface TemplateCategory {
	name: string;
	templates: MathTemplate[];
	// Use wider buttons for templates whose previews are long.
	wide?: boolean;
}

// A matrix-like environment whose size is picked in the palette.
export interface MatrixKind {
	label: string;
	env: string;
	// Fixed number of columns, e.g. `cases` is always "value & condition".
	columns?: number;
}

export interface MatrixCategory {
	name: string;
	matrices: MatrixKind[];
}

export const MAX_MATRIX_SIZE = 6;

export function matrixTemplate(
	kind: MatrixKind,
	rows: number,
	columns: number,
): MathTemplate {
	const row = Array<string>(kind.columns ?? columns).fill(SLOT).join(' & ');
	const body = Array<string>(rows).fill(row).join(' \\\\ ');
	return {
		label: kind.label,
		latex: `\\begin{${kind.env}} ${body} \\end{${kind.env}}`,
	};
}

const symbols = (label: string, commands: string[]): TemplateCategory => ({
	name: label,
	templates: commands.map((latex) => ({ label: latex, latex })),
});

export const CATEGORIES: (TemplateCategory | MatrixCategory)[] = [
	{
		name: 'Structures',
		templates: [
			{ label: 'Fraction', latex: '\\frac{#}{#}' },
			{ label: 'Square root', latex: '\\sqrt{#}' },
			{ label: 'n-th root', latex: '\\sqrt[#]{#}' },
			{ label: 'Superscript', latex: '{#}^{#}' },
			{ label: 'Subscript', latex: '{#}_{#}' },
			{ label: 'Sub- and superscript', latex: '{#}_{#}^{#}' },
			{ label: 'Text', latex: '\\text{#}', placeholder: 'text' },
		],
	},
	{
		name: 'Big operators',
		wide: true,
		templates: [
			{ label: 'Sum', latex: '\\sum_{#}^{#} #' },
			{ label: 'Product', latex: '\\prod_{#}^{#} #' },
			{ label: 'Integral', latex: '\\int_{#}^{#} # \\,d#' },
			{ label: 'Contour integral', latex: '\\oint_{#} # \\,d#' },
			{ label: 'Limit', latex: '\\lim_{# \\to #} #' },
		],
	},
	{
		name: 'Brackets',
		templates: [
			{ label: 'Parentheses', latex: '\\left( # \\right)' },
			{ label: 'Square brackets', latex: '\\left[ # \\right]' },
			{ label: 'Braces', latex: '\\left\\{ # \\right\\}' },
			{ label: 'Absolute value', latex: '\\left| # \\right|' },
			{ label: 'Norm', latex: '\\left\\| # \\right\\|' },
			{ label: 'Angle brackets', latex: '\\left\\langle # \\right\\rangle' },
		],
	},
	{
		name: 'Accents',
		templates: [
			{ label: 'Hat', latex: '\\hat{#}' },
			{ label: 'Bar', latex: '\\bar{#}' },
			{ label: 'Vector', latex: '\\vec{#}' },
			{ label: 'Dot', latex: '\\dot{#}' },
			{ label: 'Double dot', latex: '\\ddot{#}' },
			{ label: 'Tilde', latex: '\\tilde{#}' },
			{ label: 'Overline', latex: '\\overline{#}' },
		],
	},
	{
		name: 'Matrices & cases',
		matrices: [
			{ label: 'Matrix ( )', env: 'pmatrix' },
			{ label: 'Matrix [ ]', env: 'bmatrix' },
			{ label: 'Matrix { }', env: 'Bmatrix' },
			{ label: 'Determinant', env: 'vmatrix' },
			{ label: 'Norm', env: 'Vmatrix' },
			{ label: 'Matrix without brackets', env: 'matrix' },
			{ label: 'Cases (uses the rows only)', env: 'cases', columns: 2 },
		],
	},
	{
		name: 'Functions',
		wide: true,
		templates: ['sin', 'cos', 'tan', 'log', 'ln', 'exp', 'min', 'max'].map(
			(name) => ({ label: name, latex: `\\${name}\\left( # \\right)` }),
		),
	},
	symbols('Greek', [
		'\\alpha', '\\beta', '\\gamma', '\\delta', '\\epsilon', '\\varepsilon',
		'\\zeta', '\\eta', '\\theta', '\\lambda', '\\mu', '\\nu', '\\xi',
		'\\pi', '\\rho', '\\sigma', '\\tau', '\\phi', '\\varphi', '\\chi',
		'\\psi', '\\omega', '\\Gamma', '\\Delta', '\\Theta', '\\Lambda',
		'\\Pi', '\\Sigma', '\\Phi', '\\Psi', '\\Omega',
	]),
	symbols('Operators', [
		'+', '-', '\\pm', '\\mp', '\\cdot', '\\times', '\\div', '\\circ',
		'\\partial', '\\nabla', '\\infty', '\\cup', '\\cap', '\\setminus',
	]),
	symbols('Relations', [
		'=', '\\neq', '<', '>', '\\leq', '\\geq', '\\approx', '\\equiv',
		'\\sim', '\\propto', '\\in', '\\notin', '\\subset', '\\subseteq',
	]),
	symbols('Arrows & logic', [
		'\\to', '\\leftarrow', '\\Rightarrow', '\\Leftarrow', '\\Leftrightarrow',
		'\\mapsto', '\\forall', '\\exists', '\\neg', '\\land', '\\lor',
	]),
];

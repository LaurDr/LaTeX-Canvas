// A template is the LaTeX inserted when a palette button is clicked.
// `#` marks an empty slot: it is removed on insert, the first slot receives
// the current selection (if any) and the cursor lands in the next free slot.
// `#` is the macro-parameter character in TeX, so it never appears in a real
// equation body and is safe to use as a marker.
export const SLOT = '#';

export interface MathTemplate {
	label: string;
	latex: string;
}

export interface TemplateCategory {
	name: string;
	templates: MathTemplate[];
}

const symbols = (label: string, commands: string[]): TemplateCategory => ({
	name: label,
	templates: commands.map((latex) => ({ label: latex, latex })),
});

export const CATEGORIES: TemplateCategory[] = [
	{
		name: 'Structures',
		templates: [
			{ label: 'Fraction', latex: '\\frac{#}{#}' },
			{ label: 'Square root', latex: '\\sqrt{#}' },
			{ label: 'n-th root', latex: '\\sqrt[#]{#}' },
			{ label: 'Superscript', latex: '{#}^{#}' },
			{ label: 'Subscript', latex: '{#}_{#}' },
			{ label: 'Sub- and superscript', latex: '{#}_{#}^{#}' },
			{ label: 'Text', latex: '\\text{#}' },
		],
	},
	{
		name: 'Big operators',
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
		templates: [
			{
				label: '2×2 matrix ( )',
				latex: '\\begin{pmatrix} # & # \\\\ # & # \\end{pmatrix}',
			},
			{
				label: '2×2 matrix [ ]',
				latex: '\\begin{bmatrix} # & # \\\\ # & # \\end{bmatrix}',
			},
			{
				label: 'Determinant',
				latex: '\\begin{vmatrix} # & # \\\\ # & # \\end{vmatrix}',
			},
			{
				label: 'Cases',
				latex: '\\begin{cases} # & # \\\\ # & # \\end{cases}',
			},
		],
	},
	{
		name: 'Functions',
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

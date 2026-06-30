// Minimal dense linear algebra for small (<=12x12) systems — just enough to fit
// a ridge logistic regression by IRLS and read standard errors off the inverse
// Hessian. Not optimized; the matrices here are tiny.

export type Matrix = number[][];
export type Vector = number[];

export function zeros(n: number): Vector {
  return new Array<number>(n).fill(0);
}

export function matVec(A: Matrix, x: Vector): Vector {
  const n = A.length;
  const out = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    let s = 0;
    const row = A[i];
    for (let j = 0; j < row.length; j++) s += row[j] * x[j];
    out[i] = s;
  }
  return out;
}

// Invert a square matrix via Gauss–Jordan with partial pivoting.
// Returns null if (near-)singular — callers add ridge to avoid that.
export function inverse(A: Matrix): Matrix | null {
  const n = A.length;
  // augmented [A | I]
  const M: number[][] = A.map((row, i) => [
    ...row,
    ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  ]);

  for (let col = 0; col < n; col++) {
    // partial pivot
    let pivot = col;
    let best = Math.abs(M[col][col]);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(M[r][col]);
      if (v > best) {
        best = v;
        pivot = r;
      }
    }
    if (best < 1e-12) return null;
    if (pivot !== col) {
      const tmp = M[col];
      M[col] = M[pivot];
      M[pivot] = tmp;
    }
    const pv = M[col][col];
    for (let j = 0; j < 2 * n; j++) M[col][j] /= pv;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      if (f === 0) continue;
      for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[col][j];
    }
  }
  return M.map((row) => row.slice(n));
}

export function diag(A: Matrix): Vector {
  return A.map((row, i) => row[i]);
}

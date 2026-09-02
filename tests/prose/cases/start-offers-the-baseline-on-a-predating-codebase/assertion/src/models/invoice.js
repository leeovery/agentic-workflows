class Invoice { constructor(lines) { this.lines = lines; } total() { return this.lines.reduce((s, l) => s + l.amount, 0); } }
module.exports = Invoice;

// Source snippets for the C code-reading questions. The generator runs them; the answers are NOT written here.
// Each snippet is tiny, deterministic and free of undefined behaviour. `alt` edits are the mistakes students really make.
import type { Language, Spec } from "../gen-code-questions.mts";
import { extra } from "./c-extra";

const S = String.raw;

export const lang: Language = {
  language: "c",
  show: (s) => (s.top ? `${s.top.trim()}\n\n` : "") + "int main(void) {\n" + s.body.trim().split("\n").map((l) => `    ${l}`).join("\n") + "\n}",
  wrap: (shown) => `#include <stdio.h>\n#include <string.h>\n#include <stdlib.h>\n\n${shown}\n`,
};

export const specs: Spec[] = [
  ...extra,
  // ---------------------------------------------------------------- c-basics
  { m: "c-basics", body: S`printf("Hi ");
printf("there\n");
printf("Bye\n");`, alt: [[S`"Hi "`, S`"Hi\n"`], [S`"there\n"`, S`"there"`], [S`printf("Hi ");`, S`printf("Hi");`]],
    why: "\\n starts a new line. Without it, the next printf continues on the same line." },
  { m: "c-basics", body: S`int a = 7, b = 2;
printf("%d %d", a / b, a % b);`, alt: [["a % b", "b % a"], ["a / b", "a * b"], ["a / b", "a - b"]],
    why: "Both are int, so 7 / 2 is 3 (no decimal part). The remainder of 7 / 2 is 1." },
  { m: "c-basics", body: S`double d = 7 / 2;
printf("%.1f", d);`, alt: [["7 / 2", "7.0 / 2"], ["%.1f", "%.2f"], ["7 / 2", "7 % 2"]],
    why: "7 / 2 is done with ints first, so it is 3. Then 3 is stored in a double and printed as 3.0." },
  { m: "c-basics", body: S`char c = 'A';
c = c + 2;
printf("%c %d", c, c);`, alt: [["+ 2", "+ 1"], [S`"%c %d", c, c`, S`"%d %c", c, c`], ["'A'", "'a'"]],
    why: "A char is a small number. 'A' is 65, so 65 + 2 is 67, and 67 is the letter C." },
  { m: "c-basics", body: S`printf("%zu %zu", sizeof(char), sizeof(int));`, alt: [["sizeof(char)", "sizeof(double)"], ["sizeof(int)", "sizeof(long long)"], ["sizeof(int)", "sizeof(short)"]],
    why: "sizeof tells how many bytes a type uses. A char uses 1 byte and an int uses 4 bytes on this computer." },
  { m: "c-basics", body: S`int x = 5;
int a = x++;
int b = ++x;
printf("%d %d %d", a, b, x);`, alt: [["x++", "++x"], ["int b = ++x", "int b = x++"], ["int x = 5", "int x = 9"]],
    why: "x++ gives the old value first, then adds 1. ++x adds 1 first, then gives the new value." },
  { m: "c-basics", body: S`int n = 10;
n += 5;
n *= 2;
n -= 4;
printf("%d", n);`, alt: [["n *= 2", "n /= 2"], ["n += 5", "n -= 5"], ["n -= 4", "n %= 4"]],
    why: "Go line by line: 10, then 15, then 30, then 26." },
  { m: "c-basics", body: S`printf("%d %d %d", 5 > 3, 5 == 3, 5 > 3 && 2 > 4);`, alt: [["&&", "||"], ["5 == 3", "5 != 3"], ["5 > 3,", "5 < 3,"]],
    why: "A true comparison prints 1 and a false one prints 0. && is true only when both sides are true." },
  { m: "c-basics", body: S`printf("[%5d][%-5d][%05d]", 42, 42, 42);`, alt: [["42, 42, 42", "7, 42, 42"], ["%-5d", "%5d"], ["%05d", "%5d"]],
    why: "%5d makes the number 5 characters wide, with spaces on the left. %-5d puts the spaces on the right. %05d fills with zeros." },
  { m: "c-basics", body: S`int r = 2 + 3 * 4 - 6 / 2;
printf("%d", r);`, alt: [["2 + 3", "(2 + 3)"], ["6 / 2", "6 % 4"], ["3 * 4", "3 + 4"]],
    why: "Multiply and divide come before add and subtract. So 3 * 4 is 12, 6 / 2 is 3, and 2 + 12 - 3 is 11." },

  // ---------------------------------------------------------------- c-control
  { m: "c-control", body: S`int m = 65;
char g;
if (m >= 75) g = 'A';
else if (m >= 60) g = 'B';
else g = 'C';
printf("%c %d", g, m);`, alt: [["m = 65", "m = 75"], ["m = 65", "m = 40"], [">= 60", "> 65"], ["m >= 75", "m >= 60"]],
    why: "C checks the conditions from the top and stops at the first true one. 65 is not 75 or more, but it is 60 or more, so it prints B." },
  { m: "c-control", body: S`int x = 3;
if (x > 2)
    if (x > 5) printf("big ");
    else printf("mid ");
printf("end");`, alt: [["x = 3", "x = 7"], ["x = 3", "x = 1"], ["x = 3", "x = 5"]], wrong: ["mid"],
    why: "An else belongs to the nearest if. Here x is more than 2 but not more than 5, so it prints mid and then end." },
  { m: "c-control", body: S`int d = 2;
switch (d) {
    case 1: printf("Mon ");
    case 2: printf("Tue ");
    case 3: printf("Wed "); break;
    default: printf("Other");
}`, alt: [[S`case 2: printf("Tue ");`, S`case 2: printf("Tue "); break;`], ["d = 2", "d = 1"], ["d = 2", "d = 9"]],
    why: "A case without break keeps going into the next case. It starts at case 2, prints Tue, then Wed, and stops at the break." },
  { m: "c-control", body: S`int s = 0;
for (int i = 1; i <= 4; i++)
    s += i;
printf("%d", s);`, alt: [["i <= 4", "i < 4"], ["s += i", "s += i * i"], ["i++", "i += 2"]],
    why: "The loop adds 1, 2, 3 and 4. That is 10." },
  { m: "c-control", body: S`int n = 3;
while (n > 0) {
    printf("%d ", n);
    n--;
}`, alt: [["n > 0", "n > 1"], ["n--", "n -= 2"], [[S`printf("%d ", n);`, "@@P@@"], ["n--;", S`printf("%d ", n);`], ["@@P@@", "n--;"]]],
    wrong: ["2 1 0"],
    why: "It prints n, then makes n smaller by 1. It stops when n is no longer more than 0." },
  { m: "c-control", body: S`int i = 10;
do {
    printf("x");
    i++;
} while (i < 5);
printf("%d", i);`, alt: [["i < 5", "i < 12"], ["i++", "i--"], ["i = 10", "i = 2"]],
    why: "A do-while runs its body first and checks after. So it prints x once even though 11 is not less than 5." },
  { m: "c-control", body: S`for (int i = 1; i <= 6; i++) {
    if (i % 2 == 0) continue;
    if (i == 5) break;
    printf("%d ", i);
}`, alt: [["continue", "break"], ["i == 5", "i == 7"], ["i % 2 == 0", "i % 2 == 1"]],
    why: "continue skips to the next round. break stops the whole loop. Even numbers are skipped, and at 5 the loop stops, so it prints 1 3." },
  { m: "c-control", body: S`for (int i = 1; i <= 3; i++) {
    for (int j = 1; j <= i; j++)
        printf("*");
    printf("\n");
}`, alt: [["j <= i", "j <= 3"], ["i <= 3", "i <= 2"], [S`    printf("\n");`, ""]],
    why: "The inner loop prints i stars. So row 1 has 1 star, row 2 has 2 stars and row 3 has 3 stars." },
  { m: "c-control", body: S`for (int i = 1; i <= 3; i++) {
    for (int j = 1; j <= 3; j++) {
        if (j == 2) break;
        printf("%d%d ", i, j);
    }
}`, alt: [["break", "continue"], ["j == 2", "j == 3"], [S`"%d%d ", i, j`, S`"%d%d ", j, i`]],
    why: "break only leaves the inner loop. For each i, j is 1 and then at 2 the inner loop stops. So it prints 11 21 31." },
  { m: "c-control", body: S`int i;
for (i = 0; i < 3; i++);
printf("%d", i);`, alt: [["i++);", "i++)"], ["i < 3", "i <= 3"], ["i < 3", "i < 0"]],
    why: "The ; right after the for is an empty loop body. The loop only counts i up to 3, and then printf runs once." },

  // ---------------------------------------------------------------- c-functions
  { m: "c-functions", top: S`void inc(int a) {
    a = a + 1;
}`, body: S`int x = 5;
inc(x);
printf("%d", x);`, alt: [[S`a = a + 1;`, S`a = a + 1; printf("%d ", a);`], ["x = 5", "x = 0"], [S`"%d", x`, S`"%d", x * 2`]],
    why: "C gives the function a copy of x. Changing the copy does not change the real x, so x is still 5." },
  { m: "c-functions", top: S`int sq(int n) {
    return n * n;
}`, body: S`printf("%d %d", sq(3), sq(sq(2)));`, alt: [["sq(sq(2))", "sq(2) * 2"], ["n * n", "n + n"], ["n * n", "n * n * n"]],
    why: "sq(3) is 9. sq(2) is 4, and then sq(4) is 16." },
  { m: "c-functions", top: S`void f(void) {
    static int c = 0;
    c++;
    printf("%d ", c);
}`, body: S`f();
f();
f();`, alt: [["static int c = 0;", "int c = 0;"], ["c++;", "c += 2;"], ["static int c = 0", "static int c = 10"]],
    why: "A static variable keeps its value between calls and is set up only once. So it counts 1 2 3." },
  { m: "c-functions", top: S`int x = 10;
void show(void) {
    printf("%d ", x);
}`, body: S`int x = 3;
show();
printf("%d", x);`, alt: [["    int x = 3;", "    x = 3;"], [[S`    show();`, S`    printf("%d ", x);`], [S`    printf("%d", x);`, "    show();"]], ["int x = 10;", "int x = 20;"]],
    why: "main has its own x, which is 3. show uses the global x, which is 10." },
  { m: "c-functions", top: S`int f(int n) {
    if (n <= 1) return 1;
    return n * f(n - 1);
}`, body: S`printf("%d", f(4));`, alt: [["n * f(n - 1)", "n + f(n - 1)"], ["n <= 1", "n <= 2"], ["return 1;", "return 0;"]],
    why: "f(4) is 4 * 3 * 2 * 1, which is 24." },
  { m: "c-functions", top: S`void p(int n) {
    if (n == 0) return;
    printf("%d ", n);
    p(n - 1);
}`, body: S`p(3);`, alt: [[[S`    printf("%d ", n);`, "    PRINTHERE"], [S`    p(n - 1);`, S`    p(n - 1);
    printf("%d ", n);`], ["    PRINTHERE", ""]], ["n == 0", "n == 1"], ["n == 0", "n == 2"]],
    why: "It prints n first and then calls itself with a smaller number. So it prints 3 2 1." },
  { m: "c-functions", top: S`int fib(int n) {
    if (n < 2) return n;
    return fib(n - 1) + fib(n - 2);
}`, body: S`printf("%d", fib(6));`, alt: [["fib(n - 1) + fib(n - 2)", "fib(n - 1) + fib(n - 1)"], ["fib(6)", "fib(7)"], ["return n;", "return 1;"], ["fib(6)", "fib(5)"]],
    why: "Fibonacci numbers go 0 1 1 2 3 5 8. The 6th one (counting from 0) is 8." },
  { m: "c-functions", top: S`void zero(int a[]) {
    a[0] = 0;
}`, body: S`int v[3] = {5, 6, 7};
zero(v);
printf("%d %d", v[0], v[1]);`, alt: [["a[0] = 0", "a[1] = 0"], [S`    zero(v);`, ""], ["a[0] = 0", "a[0] = a[2]"]],
    why: "An array is not copied when passed. The function changes the real array, so v[0] becomes 0." },
  { m: "c-functions", top: S`void swap(int *a, int *b) {
    int t = *a;
    *a = *b;
    *b = t;
}`, body: S`int x = 1, y = 2;
swap(&x, &y);
printf("%d %d", x, y);`, alt: [["*b = t;", "*b = *a;"], ["*a = *b;", "*a = *a;"], [S`"%d %d", x, y`, S`"%d %d", y, x`]],
    why: "swap gets the addresses of x and y, so it can change the real values. After the swap x is 2 and y is 1." },
  { m: "c-functions", top: S`int max(int a, int b) {
    return a > b ? a : b;
}`, body: S`printf("%d", max(max(3, 9), max(4, 7)));`, alt: [["a > b ? a : b", "a < b ? a : b"], ["max(3, 9)", "max(3, 2)"], ["a > b ? a : b", "a > b ? b : a"]], wrong: ["16"],
    why: "max(3, 9) is 9 and max(4, 7) is 7. Then max(9, 7) is 9." },

  // ---------------------------------------------------------------- c-arrays
  { m: "c-arrays", body: S`int a[5] = {10, 20, 30, 40, 50};
printf("%d %d %d", a[0], a[4], a[2] + a[3]);`, alt: [["a[4]", "a[3]"], ["a[2] + a[3]", "a[2] * 2"], ["a[0]", "a[1]"]],
    why: "Array numbering starts at 0. a[0] is 10, a[4] is 50, and a[2] + a[3] is 30 + 40." },
  { m: "c-arrays", body: S`int a[4] = {4, 8, 6, 2};
int s = 0;
for (int i = 0; i < 4; i++)
    s += a[i];
printf("%d %d", s, s / 4);`, alt: [["i < 4", "i < 3"], ["s / 4", "s % 4"], ["s += a[i]", "s = a[i]"]],
    why: "The sum of 4, 8, 6 and 2 is 20. Divided by 4 it is 5." },
  { m: "c-arrays", body: S`int a[5] = {3, 9, 2, 9, 5};
int m = 0;
for (int i = 1; i < 5; i++)
    if (a[i] > a[m]) m = i;
printf("%d", m);`, alt: [["a[i] > a[m]", "a[i] >= a[m]"], [S`"%d", m`, S`"%d", a[m]`], ["a[i] > a[m]", "a[i] < a[m]"]],
    why: "m keeps the place of the biggest number. The biggest is 9. It is first at place 1, and > does not move for an equal 9." },
  { m: "c-arrays", body: S`int g[2][3] = {{1, 2, 3}, {4, 5, 6}};
printf("%d %d %d", g[0][2], g[1][0], g[1][2]);`, alt: [["g[0][2]", "g[0][1]"], ["g[1][0]", "g[0][0]"], ["g[1][2]", "g[1][1]"]],
    why: "g[row][column], both starting at 0. g[0][2] is 3, g[1][0] is 4, g[1][2] is 6." },
  { m: "c-arrays", body: S`int g[2][3] = {{1, 2, 3}, {4, 5, 6}};
for (int i = 0; i < 2; i++) {
    int s = 0;
    for (int j = 0; j < 3; j++)
        s += g[i][j];
    printf("%d ", s);
}`, alt: [["j < 3", "j < 2"], ["s += g[i][j]", "s += g[i][j] * 2"], ["i < 2", "i < 1"]],
    why: "Each row is added up on its own. Row 0 is 1 + 2 + 3 = 6. Row 1 is 4 + 5 + 6 = 15." },
  { m: "c-arrays", body: S`int a[5] = {1, 2};
printf("%d %d %d", a[1], a[2], a[4]);`, alt: [["{1, 2}", "{1, 2, 3}"], ["a[4]", "a[0]"], ["a[1],", "a[0],"]],
    why: "When you give fewer values than the size, the rest are set to 0." },
  { m: "c-arrays", body: S`int a[5] = {7, 3, 9, 3, 1};
int pos = -1;
for (int i = 0; i < 5; i++)
    if (a[i] == 3) {
        pos = i;
        break;
    }
printf("%d", pos);`, alt: [[S`        break;`, ""], ["a[i] == 3", "a[i] == 4"], ["pos = i;", "pos = i + 1;"]],
    why: "It stops at the first 3, which is at place 1. Without break it would keep going and end at the last 3." },
  { m: "c-arrays", body: S`int a[4] = {4, 3, 2, 1};
for (int j = 0; j < 3; j++)
    if (a[j] > a[j + 1]) {
        int t = a[j];
        a[j] = a[j + 1];
        a[j + 1] = t;
    }
for (int i = 0; i < 4; i++)
    printf("%d ", a[i]);`, alt: [["a[j] > a[j + 1]", "a[j] < a[j + 1]"], ["j < 3", "j < 2"], ["j < 3", "j < 1"]],
    why: "One pass of bubble sort pushes the biggest number to the end. 4 moves right past 3, 2 and 1, so the array becomes 3 2 1 4." },
  { m: "c-arrays", body: S`int a[4] = {1, 2, 3, 4};
for (int i = 0; i < 2; i++) {
    int t = a[i];
    a[i] = a[3 - i];
    a[3 - i] = t;
}
for (int i = 0; i < 4; i++)
    printf("%d ", a[i]);`, alt: [["i < 2", "i < 4"], ["i < 2", "i < 1"], ["a[3 - i]", "a[2 - i]"]],
    why: "It swaps the first with the last, then the second with the third. That reverses the array to 4 3 2 1." },
  { m: "c-arrays", body: S`int a[6] = {1, 2, 1, 3, 1, 2};
int c[4] = {0};
for (int i = 0; i < 6; i++)
    c[a[i]]++;
printf("%d %d %d", c[1], c[2], c[3]);`, alt: [["c[a[i]]++", "c[a[i]] += 2"], ["i < 6", "i < 5"], [S`c[1], c[2], c[3]`, S`c[3], c[2], c[1]`]],
    why: "c[k] counts how many times k appears. 1 appears 3 times, 2 appears 2 times and 3 appears 1 time." },

  // ---------------------------------------------------------------- c-strings
  { m: "c-strings", body: S`char s[] = "code";
printf("%zu %zu", strlen(s), sizeof(s));`, alt: [[S`"code"`, S`"coding"`], [S`strlen(s), sizeof(s)`, S`sizeof(s), strlen(s)`], [S`char s[] =`, S`char s[10] =`]],
    why: "strlen counts the letters (4). sizeof counts the bytes, and a string has one extra byte for the end mark, so it is 5." },
  { m: "c-strings", body: S`char s[] = "hey";
s[0] = 'H';
printf("%s", s);`, alt: [["s[0] = 'H'", "s[1] = '\\0'"], ["s[0] = 'H'", "s[2] = 'Y'"], [S`"%s", s`, S`"%c", s[0]`]],
    why: "You can change one letter of a char array. s[0] becomes H, so the string is Hey." },
  { m: "c-strings", body: S`char a[20] = "Hi";
strcat(a, " Ravi");
printf("%s %zu", a, strlen(a));`, alt: [[S`" Ravi"`, S`" Raj"`], ["strcat(a,", "strcpy(a,"], ["strlen(a)", "sizeof(a)"]],
    why: "strcat adds the second string to the end of the first. \"Hi Ravi\" has 7 letters." },
  { m: "c-strings", body: S`printf("%d %d", strcmp("apple", "apple") == 0, strcmp("a", "b") < 0);`, alt: [[S`"apple", "apple"`, S`"apple", "Apple"`], [S`"a", "b"`, S`"b", "a"`], ["< 0", "> 0"]],
    wrong: ["0 0", "1 1 1"],
    why: "strcmp gives 0 when two strings are the same, and a number below 0 when the first comes before the second. A comparison prints 1 for true." },
  { m: "c-strings", body: S`char s[] = "education";
int v = 0;
for (int i = 0; s[i]; i++) {
    char c = s[i];
    if (c == 'a' || c == 'e' || c == 'i' || c == 'o' || c == 'u') v++;
}
printf("%d", v);`, alt: [["s[i];", "i < 5;"], ["v++", "v += 2"], [" || c == 'u'", ""]],
    why: "The vowels in education are e, u, a, i, o. That is 5." },
  { m: "c-strings", body: S`char s[] = "abc1";
for (int i = 0; s[i]; i++)
    if (s[i] >= 'a' && s[i] <= 'z') s[i] -= 32;
printf("%s", s);`, alt: [["-= 32", "+= 1"], ["<= 'z'", "<= 'b'"], ["-= 32", "-= 31"]],
    why: "A small letter minus 32 is the capital letter. The digit 1 is not between a and z, so it stays." },
  { m: "c-strings", body: S`char s[] = "stop";
int n = strlen(s);
for (int i = 0; i < n / 2; i++) {
    char t = s[i];
    s[i] = s[n - 1 - i];
    s[n - 1 - i] = t;
}
printf("%s", s);`, alt: [["n / 2", "n"], ["n / 2", "n / 2 - 1"], ["n - 1 - i", "n - 2 - i"]],
    why: "It swaps the first and last letters, then the two in the middle. That reverses stop into pots." },
  { m: "c-strings", body: S`char s[] = "level";
int n = strlen(s), m = 0;
for (int i = 0; i < n / 2; i++)
    if (s[i] == s[n - 1 - i]) m++;
printf("%d of %d", m, n / 2);`, alt: [[S`"level"`, S`"lever"`], [S`"level"`, S`"ab"`], [S`"level"`, S`"lemon"`]],
    why: "It compares letters from both ends. In level, l = l and e = e, so both pairs match." },
  { m: "c-strings", body: S`char s[] = "my college code";
char *p = strstr(s, "co");
printf("%ld %s", (long)(p - s), p);`, alt: [[S`"co"`, S`"de"`], [S`"co"`, S`"ge"`], [S`strstr(s, "co")`, S`strrchr(s, 'c')`]],
    why: "strstr finds the first place where co appears. That is at place 3, and p points to the rest of the text from there." },
  { m: "c-strings", body: S`char d = '7';
int n = d - '0';
printf("%d %d", n + 1, d + 1);`, alt: [["d - '0'", "d"], ["d + 1", "n + 1"], ["n + 1,", "n * 2,"]],
    why: "The character '7' is the number 55 inside the computer. Taking away '0' (48) gives the number 7. So n + 1 is 8 and d + 1 is 56." },

  // ---------------------------------------------------------------- c-pointers
  { m: "c-pointers", body: S`int x = 10;
int *p = &x;
*p = *p + 5;
printf("%d %d", x, *p);`, alt: [["*p + 5", "*p * 2"], ["*p = *p + 5;", "*p = 5;"], [S`    *p = *p + 5;`, ""]],
    why: "p holds the address of x, so *p is x itself. Changing *p changes x. Both print 15." },
  { m: "c-pointers", body: S`int a = 1, b = 2;
int *p = &a;
int *q = p;
*q = 7;
p = &b;
*p = 9;
printf("%d %d", a, b);`, alt: [["*q = 7", "*q = 3"], ["p = &b;", "p = &a;"], ["int *q = p;", "int *q = &b;"]],
    why: "q points to a, so *q = 7 makes a 7. Then p moves to b, and *p = 9 makes b 9." },
  { m: "c-pointers", body: S`int a[4] = {10, 20, 30, 40};
int *p = a;
p += 2;
printf("%d %d %d", *p, *(p - 1), p[1]);`, alt: [["p += 2", "p += 1"], ["*(p - 1)", "*(p + 1)"], ["p[1]", "p[-1]"]],
    why: "p += 2 moves the pointer two numbers forward, to 30. One back is 20, and one forward is 40." },
  { m: "c-pointers", body: S`int a[3] = {5, 6, 7};
int *p = a;
printf("%d %d %d", *p, *(a + 2), p[1]);`, alt: [["*(a + 2)", "*(a + 1)"], ["p[1]", "p[2]"], ["*p,", "*p + 1,"]],
    why: "An array name is the address of its first number. *p is a[0], *(a + 2) is a[2], and p[1] is a[1]." },
  { m: "c-pointers", body: S`int a[5] = {1, 2, 3, 4, 5};
int *p = a, *e = a + 5;
int s = 0;
while (p < e) {
    s += *p;
    p += 2;
}
printf("%d", s);`, alt: [["p += 2", "p++"], ["a + 5", "a + 4"], ["s += *p", "s += *p * 2"]],
    why: "p jumps two numbers each time: it reads 1, then 3, then 5. The sum is 9." },
  { m: "c-pointers", top: S`void dbl(int *n) {
    *n *= 2;
}`, body: S`int v = 4;
dbl(&v);
dbl(&v);
printf("%d", v);`, alt: [["*n *= 2", "*n += 2"], ["*n *= 2", "*n *= *n"], ["*n *= 2", "*n -= 2"]],
    why: "Each call doubles the real v. 4 becomes 8, and then 16." },
  { m: "c-pointers", top: S`int *big(int *a, int *b) {
    return *a > *b ? a : b;
}`, body: S`int x = 3, y = 8;
int *p = big(&x, &y);
*p = 0;
printf("%d %d", x, y);`, alt: [["*a > *b", "*a < *b"], ["*p = 0", "*p = *p + 1"], [S`"%d %d", x, y`, S`"%d %d", y, x`]],
    why: "big returns the address of the bigger number, which is y. So *p = 0 sets y to 0, and x stays 3." },
  { m: "c-pointers", body: S`int *p = NULL;
if (p == NULL) printf("null ");
else printf("%d ", *p);
int v = 4;
p = &v;
if (p) printf("%d", *p);`, alt: [["int v = 4", "int v = 9"], ["if (p) printf", "if (!p) printf"], [S`"null "`, S`"nil "`]],
    why: "A NULL pointer points to nothing, so it prints null and never reads *p. After p = &v, the pointer is not NULL and prints 4." },
  { m: "c-pointers", body: S`int a[3] = {1, 2, 3};
int *p = a;
int t = 0;
for (int i = 0; i < 3; i++)
    t += *p++;
printf("%d", t);`, alt: [["i < 3", "i < 2"], ["t += *p++", "t += *p"], ["t += *p++", "t += *p++ * 2"], ["int t = 0", "int t = 10"]],
    why: "*p++ reads the number p points to, then moves p to the next one. So it adds 1, 2 and 3." },
  { m: "c-pointers", body: S`int a[10];
int *p = a;
printf("%zu %zu", sizeof(a), sizeof(p));`, alt: [["a[10]", "a[5]"], ["sizeof(a), sizeof(p)", "sizeof(*p), sizeof(p)"], ["sizeof(p)", "sizeof(a[0])"]],
    why: "sizeof(a) is the whole array: 10 numbers of 4 bytes is 40. A pointer is only an address, and it is 8 bytes on this computer." },

  // ---------------------------------------------------------------- c-memory
  { m: "c-memory", body: S`int *a = malloc(3 * sizeof(int));
for (int i = 0; i < 3; i++)
    a[i] = i + 1;
int s = 0;
for (int i = 0; i < 3; i++)
    s += a[i];
printf("%d", s);
free(a);`, alt: [["i + 1", "i * 3"], ["i + 1", "(i + 1) * (i + 1)"], ["s += a[i]", "s = a[i]"]],
    why: "malloc gives room for 3 ints. They are filled with 1, 2 and 3, and the sum is 6." },
  { m: "c-memory", body: S`int *a = calloc(4, sizeof(int));
a[1] = 5;
printf("%d %d %d", a[0], a[1], a[3]);
free(a);`, alt: [["a[1] = 5", "a[3] = 5"], ["a[1] = 5", "a[0] = 5"], [S`a[0], a[1], a[3]`, S`a[1], a[1], a[1]`]],
    why: "calloc sets every number to 0 first. Only a[1] was changed to 5." },
  { m: "c-memory", body: S`int *a = malloc(2 * sizeof(int));
a[0] = 1;
a[1] = 2;
a = realloc(a, 4 * sizeof(int));
a[2] = 3;
a[3] = 4;
int s = 0;
for (int i = 0; i < 4; i++)
    s += a[i];
printf("%d", s);
free(a);`, alt: [["a[3] = 4", "a[3] = 40"], ["a[1] = 2", "a[1] = 20"], ["i < 4;", "i < 3;"]],
    why: "realloc makes the block bigger and keeps the old numbers. The four numbers are 1, 2, 3 and 4, and the sum is 10." },
  { m: "c-memory", body: S`char *s = malloc(6);
strcpy(s, "hello");
s[0] = 'j';
printf("%s %zu", s, strlen(s));
free(s);`, alt: [["s[0] = 'j'", "s[1] = '\\0'"], ["s[0] = 'j'", "s[4] = '!'"], [S`"hello"`, S`"hi"`]],
    why: "A string needs one extra byte for the end mark, so 6 bytes hold hello. Changing the first letter gives jello, which still has 5 letters." },
  { m: "c-memory", body: S`int *p = malloc(sizeof(int));
*p = 8;
int *q = p;
printf("%d ", *q);
free(p);
p = NULL;
printf(p == NULL ? "freed" : "in use");`, alt: [["*p = 8", "*p = 18"], ["    p = NULL;", ""], [S`"freed"`, S`"free"`]],
    why: "q and p point to the same place, so *q is 8. After free, setting p to NULL shows that p points to nothing now." },
  { m: "c-memory", body: S`int a[4] = {1, 2, 3, 4}, b[4] = {0};
memcpy(b, a, 2 * sizeof(int));
printf("%d %d %d", b[0], b[1], b[2]);`, alt: [["2 * sizeof(int)", "3 * sizeof(int)"], ["2 * sizeof(int)", "sizeof(int)"], ["memcpy(b, a,", "memcpy(a, b,"]],
    why: "memcpy copies bytes. It copies the first 2 numbers from a into b, so b is 1 2 0 0." },
  { m: "c-memory", body: S`int **m = malloc(2 * sizeof(int *));
for (int i = 0; i < 2; i++) {
    m[i] = malloc(2 * sizeof(int));
    for (int j = 0; j < 2; j++)
        m[i][j] = i + j;
}
printf("%d %d", m[1][1], m[0][1]);`, alt: [["i + j", "i * j"], ["i + j", "i * 2 + j"], [S`m[1][1], m[0][1]`, S`m[0][0], m[1][0]`]],
    why: "Each row is made with its own malloc. The number in row i and column j is i + j, so m[1][1] is 2 and m[0][1] is 1." },
  { m: "c-memory", body: S`int *c = malloc(sizeof(int));
*c = 0;
for (int i = 0; i < 5; i++)
    if (i % 2) (*c)++;
printf("%d", *c);
free(c);`, alt: [["i % 2)", "i % 2 == 0)"], ["(*c)++", "*c += 10"], ["i < 5", "i < 6"], ["*c = 0", "*c = 5"]],
    why: "i % 2 is true for odd numbers only. Between 0 and 4 the odd numbers are 1 and 3, so *c is counted up 2 times." },
  { m: "c-memory", body: S`char *src = "abc";
char *d = malloc(strlen(src) + 1);
int i;
for (i = 0; src[i]; i++)
    d[i] = src[i] - 32;
d[i] = '\0';
printf("%s", d);
free(d);`, alt: [["- 32", "+ 1"], ["- 32", "- 31"], [S`"abc"`, S`"xyz"`]],
    why: "Each small letter minus 32 becomes a capital letter. The extra byte holds the end mark." },
  { m: "c-memory", body: S`char *s = malloc(20);
strcpy(s, "abc");
printf("%zu %zu", strlen(s), sizeof(s));
free(s);`, alt: [["sizeof(s)", "sizeof(*s)"], [S`"abc"`, S`"abcdef"`], [S`strlen(s), sizeof(s)`, S`sizeof(s), strlen(s)`]],
    why: "strlen counts the letters in the string: 3. sizeof(s) is the size of the pointer, not the 20 bytes it points to: 8." },

  // ---------------------------------------------------------------- c-structs
  { m: "c-structs", top: S`struct P { int x; int y; };`, body: S`struct P a = {3, 4};
struct P b = a;
b.x = 9;
printf("%d %d %d", a.x, b.x, b.y);`, alt: [["b.x = 9", "a.x = 9"], ["b.x = 9", "b.y = 9"], ["struct P b = a;", "struct P b = {0, 0};"]],
    why: "struct P b = a makes a copy. Changing b does not change a." },
  { m: "c-structs", top: S`struct S { int n; };`, body: S`struct S s = {5};
struct S *p = &s;
p->n++;
(*p).n += 2;
printf("%d", s.n);`, alt: [["p->n++", "p->n--"], ["(*p).n += 2", "(*p).n *= 2"], ["s = {5}", "s = {0}"]],
    why: "p->n and (*p).n mean the same thing. n goes 5, then 6, then 8." },
  { m: "c-structs", top: S`struct D { int d, m; };
struct E { char *name; struct D dob; };`, body: S`struct E e = {"Ravi", {5, 12}};
printf("%s %d/%d", e.name, e.dob.d, e.dob.m);`, alt: [[S`e.dob.d, e.dob.m`, S`e.dob.m, e.dob.d`], ["{5, 12}", "{15, 2}"], [S`"Ravi"`, S`"Sita"`]],
    why: "You reach inside a struct with a dot, one level at a time. e.dob.d is 5 and e.dob.m is 12." },
  { m: "c-structs", top: S`struct S { char n[8]; int m; };`, body: S`struct S a[3] = {{"A", 50}, {"B", 70}, {"C", 60}};
int best = 0;
for (int i = 1; i < 3; i++)
    if (a[i].m > a[best].m) best = i;
printf("%s %d", a[best].n, a[best].m);`, alt: [["a[i].m > a[best].m", "a[i].m < a[best].m"], [S`{"B", 70}`, S`{"B", 40}`], [S`a[best].n, a[best].m`, S`a[best].n, a[0].m`]],
    why: "best keeps the place of the biggest marks. B has 70, which is more than 50 and 60." },
  { m: "c-structs", top: S`struct I { int q; int p; };`, body: S`struct I c[3] = {{2, 10}, {1, 50}, {3, 5}};
int t = 0;
for (int i = 0; i < 3; i++)
    t += c[i].q * c[i].p;
printf("%d", t);`, alt: [["c[i].q * c[i].p", "c[i].q + c[i].p"], ["t +=", "t ="], ["i < 3", "i < 2"]],
    why: "Each item is quantity times price: 20, 50 and 15. The total is 85." },
  { m: "c-structs", top: S`union U { int i; char c; };`, body: S`printf("%zu %zu", sizeof(union U), sizeof(int));`, alt: [["int i; char c;", "int i; double d;"], ["int i; char c;", "char a; char b;"], ["int i; char c;", "int i; char c[10];"]],
    why: "All members of a union share the same memory. The union is as big as its biggest member, which here is the int: 4 bytes." },
  { m: "c-structs", top: S`enum C { RED, GREEN = 5, BLUE };`, body: S`printf("%d %d %d", RED, GREEN, BLUE);`, alt: [["GREEN = 5", "GREEN"], ["GREEN = 5", "GREEN = 10"], ["RED,", "RED = 1,"]],
    why: "An enum starts at 0 and counts up by 1. GREEN = 5 sets a new start, so BLUE continues with 6." },
  { m: "c-structs", top: S`enum L { LOW, MID, HIGH };`, body: S`enum L x = MID;
switch (x) {
    case LOW: printf("L"); break;
    case MID: printf("M");
    case HIGH: printf("H");
}`, alt: [["x = MID", "x = HIGH"], ["x = MID", "x = LOW"], [S`printf("M");`, S`printf("M"); break;`]],
    why: "MID has no break, so it goes on into the next case. It prints M and then H." },
  { m: "c-structs", top: S`struct P { int x; };
void f(struct P p) {
    p.x = 99;
}`, body: S`struct P a = {1};
f(a);
printf("%d", a.x);`, alt: [[[S`void f(struct P p) {
    p.x = 99;`, S`void f(struct P *p) {
    p->x = 99;`], ["f(a);", "f(&a);"]], ["a = {1}", "a = {7}"], [S`"%d", a.x`, S`"%d", a.x + 1`]],
    why: "A struct is copied when you pass it to a function. The function changes only its own copy, so a.x is still 1." },
  { m: "c-structs", top: S`struct P { int x, y; };
struct P mk(int a, int b) {
    struct P p = {a, b};
    return p;
}`, body: S`struct P r = mk(2, 5);
printf("%d", r.x * r.y);`, alt: [["r.x * r.y", "r.x + r.y"], ["mk(2, 5)", "mk(5, 3)"], ["r.x * r.y", "r.x - r.y"]],
    why: "mk builds a struct and returns a copy of it. r.x is 2 and r.y is 5, so the product is 10." },

  // ---------------------------------------------------------------- c-files
  { m: "c-files", body: S`FILE *f = fopen("t.txt", "w");
fprintf(f, "%d %d", 4, 5);
fclose(f);
f = fopen("t.txt", "r");
int a, b;
fscanf(f, "%d %d", &a, &b);
fclose(f);
printf("%d", a + b);`, alt: [["4, 5", "40, 5"], ["a + b", "a * b"], ["a + b", "b - a"]],
    why: "It writes 4 and 5 into the file, reads them back, and adds them. That is 9." },
  { m: "c-files", body: S`FILE *f = fopen("l.txt", "w");
fputs("a\nb\nc\n", f);
fclose(f);
f = fopen("l.txt", "r");
char l[10];
int n = 0;
while (fgets(l, 10, f)) n++;
fclose(f);
printf("%d", n);`, alt: [[S`"a\nb\nc\n"`, S`"a\n\n\nb\n"`], ["n++", "n += 2"], [S`"a\nb\nc\n"`, S`""`]],
    why: "fgets reads one line each time, and the loop ends at the end of the file. There are 3 lines." },
  { m: "c-files", body: S`FILE *f = fopen("a.txt", "w");
fputs("x", f);
fclose(f);
f = fopen("a.txt", "a");
fputs("y", f);
fclose(f);
f = fopen("a.txt", "r");
char s[10];
fgets(s, 10, f);
fclose(f);
printf("%s", s);`, alt: [[S`"a.txt", "a"`, S`"a.txt", "w"`], [S`fputs("y", f)`, S`fputs("yz", f)`], [S`fputs("x", f)`, S`fputs("xx", f)`]],
    why: "Mode \"a\" means append: it adds to the end and keeps what was there. The file holds xy." },
  { m: "c-files", body: S`FILE *f = fopen("h.txt", "w");
fputs("hello", f);
fclose(f);
f = fopen("h.txt", "r");
int c, n = 0;
while ((c = fgetc(f)) != EOF)
    if (c == 'l') n++;
fclose(f);
printf("%d", n);`, alt: [["c == 'l'", "c == 'e'"], [S`"hello"`, S`"hello world"`], ["n++", "n += 3"]],
    why: "fgetc reads one character at a time until the end of the file. The letter l appears 2 times in hello." },
  { m: "c-files", top: S`#define SQ(x) x * x`, body: S`printf("%d %d", SQ(3), SQ(2 + 1));`, alt: [["x * x", "((x) * (x))"], ["SQ(2 + 1)", "SQ(1 + 1)"], ["SQ(3)", "SQ(4)"]],
    why: "A macro only copies text. SQ(2 + 1) becomes 2 + 1 * 2 + 1, which is 5. Use brackets around x to fix it." },
  { m: "c-files", top: S`#define N 3
#define DEBUG 1`, body: S`#if DEBUG
printf("dbg ");
#endif
printf("%d", N * 2);`, alt: [["DEBUG 1", "DEBUG 0"], ["N 3", "N 5"], ["N * 2", "N + 2"]],
    why: "#if DEBUG keeps the code only when DEBUG is not 0. N is replaced by 3, so N * 2 is 6." },
  { m: "c-files", top: S`#define MAX(a, b) ((a) > (b) ? (a) : (b))`, body: S`int i = 5;
printf("%d", MAX(i++, 3));
printf(" %d", i);`, alt: [["MAX(i++, 3)", "MAX(i, 3)"], ["MAX(i++, 3)", "MAX(i++, 9)"], ["i = 5", "i = 1"]],
    why: "A macro pastes its argument every time it is used. i++ appears twice, so i is increased twice: it prints 6 and then 7." },
  { m: "c-files", top: S`static int counter;
void hit(void) {
    counter++;
}`, body: S`hit();
hit();
printf("%d", counter);`, alt: [["    hit();\n    hit();", "    hit();\n    hit();\n    hit();"], ["counter++", "counter += 5"], ["static int counter;", "static int counter = 7;"]],
    why: "A global variable starts at 0 and keeps its value. Two calls add 1 two times." },
  { m: "c-files", top: S`#define NAME(x) #x`, body: S`printf("%s %zu", NAME(hello), strlen(NAME(hello)));`, alt: [["NAME(hello)", "NAME(hi)"], ["strlen(NAME(hello))", "sizeof(NAME(hello))"], ["strlen(NAME(hello))", "strlen(NAME(hello)) * 2"]],
    why: "# in a macro turns the word into a string. NAME(hello) becomes \"hello\", which has 5 letters." },
  { m: "c-files", top: S`int twice(int);

int twice(int n) {
    return n * 2;
}`, body: S`printf("%d", twice(4));`, alt: [["twice(4)", "twice(twice(4))"], ["n * 2", "n + 2"], ["n * 2", "n / 2"], ["twice(4)", "twice(0)"]],
    why: "The first line is the prototype: it tells C that twice exists. The function itself is written below. twice(4) is 4 * 2, which is 8." },

  // ---------------------------------------------------------------- c-advanced
  { m: "c-advanced", body: S`int a = 12, b = 10;
printf("%d %d %d %d", a & b, a | b, a ^ b, a >> 1);`, alt: [["a & b", "a && b"], ["a >> 1", "a << 1"], ["a ^ b", "a ^ a"]],
    why: "12 is 1100 and 10 is 1010. AND gives 1000 (8), OR gives 1110 (14), XOR gives 0110 (6), and shifting 12 right by 1 gives 6." },
  { m: "c-advanced", body: S`int x = 5;
printf("%d %d %d", x << 1, x << 3, x >> 1);`, alt: [["x << 3", "x << 2"], ["x >> 1", "x >> 2"], ["x << 1", "x << 0"]],
    why: "Shifting left by 1 doubles the number. Shifting right by 1 halves it (and drops the remainder). 5 << 3 is 5 * 8 = 40." },
  { m: "c-advanced", body: S`int f = 0;
f |= 1 << 2;
f |= 1 << 0;
f &= ~(1 << 2);
f ^= 1 << 3;
printf("%d", f);`, alt: [["~(1 << 2)", "(1 << 2)"], ["f ^= 1 << 3", "f ^= 1 << 0"], ["f |= 1 << 0", "f |= 1 << 1"]],
    why: "Set bit 2 (4), set bit 0 (5), clear bit 2 (1), then flip bit 3 (8). 1 + 8 is 9." },
  { m: "c-advanced", body: S`unsigned n = 13;
int c = 0;
while (n) {
    c += n & 1;
    n >>= 1;
}
printf("%d", c);`, alt: [["n = 13", "n = 15"], ["n >>= 1", "n >>= 2"], ["c += n & 1", "c += n % 2 == 0"]],
    why: "13 is 1101 in binary. It has three 1 bits." },
  { m: "c-advanced", top: S`struct N { int v; struct N *next; };`, body: S`struct N c = {3, NULL}, b = {2, &c}, a = {1, &b};
int s = 0;
for (struct N *p = &a; p; p = p->next)
    s += p->v;
printf("%d", s);`, alt: [["b = {2, &c}", "b = {2, NULL}"], ["s += p->v", "s = s * 10 + p->v"], ["c = {3, NULL}", "c = {30, NULL}"]],
    why: "Each node points to the next one. The loop walks a, b, c and adds 1 + 2 + 3." },
  { m: "c-advanced", top: S`struct N { int v; struct N *n; };`, body: S`struct N *h = NULL;
for (int i = 1; i <= 3; i++) {
    struct N *x = malloc(sizeof *x);
    x->v = i;
    x->n = h;
    h = x;
}
for (struct N *p = h; p; p = p->n)
    printf("%d ", p->v);`, alt: [["i <= 3", "i <= 4"], ["x->v = i", "x->v = i * i"], ["int i = 1", "int i = 0"]],
    why: "Each new node is put at the front of the list. So the last one added, 3, comes first." },
  { m: "c-advanced", top: S`struct N { int v; struct N *next; };
int len(struct N *p) {
    return p ? 1 + len(p->next) : 0;
}`, body: S`struct N c = {3, NULL}, b = {2, &c}, a = {1, &b};
printf("%d", len(&a));`, alt: [["1 + len", "2 + len"], [": 0", ": 1"], ["1 + len(p->next)", "len(p->next)"]],
    why: "len counts 1 for this node plus the length of the rest. An empty list (NULL) has length 0. So three nodes give 3." },
  { m: "c-advanced", body: S`int x = 3;
if (x = 5) printf("yes ");
printf("%d", x);`, alt: [["x = 5)", "x == 5)"], ["x = 5)", "x = 0)"], ["x = 5)", "x == 3)"]],
    why: "x = 5 puts 5 into x (one = is assignment). The result 5 is not 0, so the if is true. x is now 5." },
  { m: "c-advanced", body: S`char *a = "hi";
char b[] = "hi";
printf("%d %d", a == b, strcmp(a, b) == 0);`, alt: [["a == b", "strcmp(a, b) == 0"], [S`b[] = "hi"`, S`b[] = "ho"`], ["a == b", "a != b"]],
    wrong: ["1 0"],
    why: "a == b compares the addresses, and these are two different places in memory, so it is 0. strcmp compares the letters, which are the same." },
  { m: "c-advanced", body: S`int a = 2, b = 3;
printf("%d %d", a + b * 2, (a + b) * 2);`, alt: [["a + b * 2", "(a + b) * 2"], ["(a + b) * 2)", "a + b * 2)"], ["a = 2", "a = 3"]],
    why: "Multiply comes before add, so a + b * 2 is 2 + 6 = 8. Brackets go first: (a + b) * 2 is 10." },
];

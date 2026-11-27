// Cheat sheets for languages that will run once code runs on a server (they cannot run in the browser yet).
// Same shape as SHEETS in CheatSheets.jsx: [file extension, playground id (null = not runnable yet), sections].
export const MORE_SHEETS = {
  Java: ['.java', null, [
    ['Input and output', [
      ['Read numbers', 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        long big = sc.nextLong();\n        String word = sc.next();\n        sc.nextLine();               // finish the line\n        String line = sc.nextLine();\n    }\n}', 'The class must be called Main on most judges.'],
      ['Print', 'System.out.println(a + " " + b);\nSystem.out.print("no newline");\nSystem.out.printf("%.2f%n", x);   // 2 decimals'],
    ]],
    ['Loops and conditions', [
      ['Loops', 'for (int i = 0; i < n; i++) {\n    System.out.println(i);\n}\n\nfor (int x : nums) System.out.println(x);\n\nwhile (n > 0) n--;'],
      ['Conditions', 'if (x > 0) System.out.println("positive");\nelse if (x == 0) System.out.println("zero");\nelse System.out.println("negative");\n\nString label = x % 2 == 0 ? "even" : "odd";', 'Compare strings with a.equals(b), not ==.'],
    ]],
    ['Arrays, lists and strings', [
      ['Arrays and lists', 'int[] arr = new int[n];\nArrays.sort(arr);\n\nList<Integer> list = new ArrayList<>();\nlist.add(5);\nCollections.sort(list);\nint size = list.size();'],
      ['Strings', 'String s = "hello world";\ns.length();\ns.toUpperCase();\ns.split(" ");\nnew StringBuilder(s).reverse().toString();\ns.charAt(0);'],
    ]],
    ['Maps and methods', [
      ['Count things', 'Map<String, Integer> count = new HashMap<>();\nfor (String w : words)\n    count.merge(w, 1, Integer::sum);'],
      ['Methods', 'static int area(int w, int h) {\n    return w * h;\n}\n\nint a = area(3, 4);   // 12'],
    ]],
  ]],
  C: ['.c', null, [
    ['Input and output', [
      ['Read numbers', '#include <stdio.h>\n\nint main() {\n    int n;\n    long long big;\n    char word[101];\n    scanf("%d %lld %100s", &n, &big, word);\n    return 0;\n}', 'scanf needs & before number variables, not before arrays.'],
      ['Print', 'printf("%d %d\\n", a, b);\nprintf("%lld\\n", big);\nprintf("%.2f\\n", x);     // 2 decimals\nprintf("%s\\n", word);'],
    ]],
    ['Loops and conditions', [
      ['Loops', 'for (int i = 0; i < n; i++) {\n    printf("%d\\n", i);\n}\n\nwhile (n > 0) n--;'],
      ['Conditions', 'if (x > 0) printf("positive\\n");\nelse if (x == 0) printf("zero\\n");\nelse printf("negative\\n");'],
    ]],
    ['Arrays and strings', [
      ['Arrays', 'int arr[1000];\nfor (int i = 0; i < n; i++) scanf("%d", &arr[i]);\n\nint sum = 0;\nfor (int i = 0; i < n; i++) sum += arr[i];'],
      ['Strings', '#include <string.h>\n\nchar s[101];\nscanf("%100s", s);\nint len = strlen(s);\nstrcmp(a, b) == 0;     // equal?\nstrcpy(dest, s);'],
    ]],
    ['Sorting and functions', [
      ['Sort', '#include <stdlib.h>\n\nint cmp(const void *a, const void *b) {\n    return *(int *)a - *(int *)b;\n}\n\nqsort(arr, n, sizeof(int), cmp);'],
      ['Functions', 'int area(int w, int h) {\n    return w * h;\n}\n\nint a = area(3, 4);   // 12'],
    ]],
  ]],
  'C#': ['.cs', null, [
    ['Input and output', [
      ['Read numbers', 'using System;\nusing System.Linq;\n\nint n = int.Parse(Console.ReadLine());\nint[] nums = Console.ReadLine().Split(\' \').Select(int.Parse).ToArray();'],
      ['Print', 'Console.WriteLine($"{a} {b}");\nConsole.Write("no newline");\nConsole.WriteLine(x.ToString("F2"));   // 2 decimals'],
    ]],
    ['Loops and conditions', [
      ['Loops', 'for (int i = 0; i < n; i++)\n    Console.WriteLine(i);\n\nforeach (var x in nums)\n    Console.WriteLine(x);'],
      ['Conditions', 'if (x > 0) Console.WriteLine("positive");\nelse if (x == 0) Console.WriteLine("zero");\nelse Console.WriteLine("negative");\n\nvar label = x % 2 == 0 ? "even" : "odd";'],
    ]],
    ['Lists and strings', [
      ['Lists and LINQ', 'var list = new List<int> { 3, 1, 2 };\nlist.Add(5);\nlist.Sort();\nint total = list.Sum();\nvar evens = list.Where(x => x % 2 == 0).ToList();'],
      ['Strings', 'string s = "hello world";\ns.Length;\ns.ToUpper();\ns.Split(\' \');\nnew string(s.Reverse().ToArray());'],
    ]],
    ['Dictionaries and methods', [
      ['Count things', 'var count = new Dictionary<string, int>();\nforeach (var w in words)\n    count[w] = count.GetValueOrDefault(w) + 1;'],
      ['Methods', 'static int Area(int w, int h) => w * h;\n\nint a = Area(3, 4);   // 12'],
    ]],
  ]],
  Go: ['.go', null, [
    ['Input and output', [
      ['Read numbers', 'package main\n\nimport "fmt"\n\nfunc main() {\n    var n, a, b int\n    fmt.Scan(&n)\n    fmt.Scan(&a, &b)\n}', 'For big inputs use bufio.NewReader(os.Stdin) with fmt.Fscan.'],
      ['Print', 'fmt.Println(a, b)\nfmt.Printf("%d %s\\n", n, word)\nfmt.Printf("%.2f\\n", x)   // 2 decimals'],
    ]],
    ['Loops and conditions', [
      ['Loops', 'for i := 0; i < n; i++ {\n    fmt.Println(i)\n}\n\nfor i, x := range nums {\n    fmt.Println(i, x)\n}\n\nfor n > 0 {   // Go has no while\n    n--\n}'],
      ['Conditions', 'if x > 0 {\n    fmt.Println("positive")\n} else if x == 0 {\n    fmt.Println("zero")\n} else {\n    fmt.Println("negative")\n}'],
    ]],
    ['Slices and strings', [
      ['Slices', 'import "sort"\n\nnums := []int{3, 1, 2}\nnums = append(nums, 5)\nsort.Ints(nums)\nfmt.Println(len(nums))'],
      ['Strings', 'import "strings"\n\ns := "hello world"\nstrings.ToUpper(s)\nstrings.Fields(s)          // split on spaces\nstrings.Contains(s, "lo")\nlen(s)'],
    ]],
    ['Maps and functions', [
      ['Count things', 'count := map[string]int{}\nfor _, w := range words {\n    count[w]++\n}'],
      ['Functions', 'func area(w, h int) int {\n    return w * h\n}\n\nfunc divmod(a, b int) (int, int) {\n    return a / b, a % b\n}'],
    ]],
  ]],
  Rust: ['.rs', null, [
    ['Input and output', [
      ['Read numbers', 'use std::io::{self, Read};\n\nfn main() {\n    let mut s = String::new();\n    io::stdin().read_to_string(&mut s).unwrap();\n    let nums: Vec<i64> = s.split_whitespace()\n        .map(|x| x.parse().unwrap())\n        .collect();\n}', 'Reading everything at once is the simplest way in Rust.'],
      ['Print', 'println!("{} {}", a, b);\nprintln!("{a} {b}");\nprintln!("{:.2}", x);   // 2 decimals'],
    ]],
    ['Loops and conditions', [
      ['Loops', 'for i in 0..n {          // 0 .. n-1\n    println!("{}", i);\n}\n\nfor (i, x) in nums.iter().enumerate() {\n    println!("{} {}", i, x);\n}\n\nwhile n > 0 { n -= 1; }'],
      ['Conditions', 'if x > 0 {\n    println!("positive");\n} else if x == 0 {\n    println!("zero");\n} else {\n    println!("negative");\n}\n\nlet label = if x % 2 == 0 { "even" } else { "odd" };'],
    ]],
    ['Vectors and strings', [
      ['Vectors', 'let mut v = vec![3, 1, 2];\nv.push(5);\nv.sort();\nlet total: i64 = v.iter().sum();\nlet big = v.iter().max().unwrap();'],
      ['Strings', 'let s = String::from("hello world");\ns.len();\ns.to_uppercase();\nlet words: Vec<&str> = s.split_whitespace().collect();\nlet rev: String = s.chars().rev().collect();'],
    ]],
    ['Maps and functions', [
      ['Count things', 'use std::collections::HashMap;\n\nlet mut count = HashMap::new();\nfor w in words {\n    *count.entry(w).or_insert(0) += 1;\n}'],
      ['Functions', 'fn area(w: i64, h: i64) -> i64 {\n    w * h   // no semicolon = return value\n}'],
    ]],
  ]],
  Kotlin: ['.kt', null, [
    ['Input and output', [
      ['Read numbers', 'fun main() {\n    val n = readln().toInt()\n    val (a, b) = readln().split(" ").map { it.toInt() }\n    val nums = readln().split(" ").map { it.toInt() }\n}'],
      ['Print', 'println("$a $b")\nprint("no newline")\nprintln("%.2f".format(x))   // 2 decimals'],
    ]],
    ['Loops and conditions', [
      ['Loops', 'for (i in 0 until n) println(i)\n\nfor ((i, x) in nums.withIndex()) println("$i $x")\n\nrepeat(3) { println("hi") }'],
      ['Conditions', 'val label = when {\n    x > 0 -> "positive"\n    x == 0 -> "zero"\n    else -> "negative"\n}'],
    ]],
    ['Lists and strings', [
      ['Lists', 'val nums = mutableListOf(3, 1, 2)\nnums.add(5)\nnums.sort()\nprintln(nums.sum())\nval evens = nums.filter { it % 2 == 0 }'],
      ['Strings', 'val s = "hello world"\ns.length\ns.uppercase()\ns.split(" ")\ns.reversed()'],
    ]],
    ['Maps and functions', [
      ['Count things', 'val count = words.groupingBy { it }.eachCount()\n\nval m = mutableMapOf<String, Int>()\nm["a"] = (m["a"] ?: 0) + 1'],
      ['Functions', 'fun area(w: Int, h: Int = 1): Int = w * h\n\nval square = { x: Int -> x * x }'],
    ]],
  ]],
  TypeScript: ['.ts', null, [
    ['Input and output', [
      ['Read numbers', 'const n: number = Number(input());\nconst [a, b] = input().split(" ").map(Number);', 'TypeScript is JavaScript with types: everything in the JavaScript sheet works here.'],
      ['Print', 'console.log(a, b);\nconsole.log(`Sum: ${a + b}`);'],
    ]],
    ['Types', [
      ['Basic types', 'let count: number = 0;\nlet name: string = "Ana";\nlet done: boolean = false;\nlet nums: number[] = [1, 2, 3];\nlet pair: [string, number] = ["a", 1];'],
      ['Objects', 'interface Student {\n  name: string;\n  score: number;\n  email?: string;   // optional\n}\n\nconst s: Student = { name: "Ana", score: 90 };'],
    ]],
    ['Arrays and strings', [
      ['Array methods', 'const doubled = nums.map(x => x * 2);\nconst big = nums.filter(x => x > 2);\nconst total = nums.reduce((s, x) => s + x, 0);\nnums.sort((a, b) => a - b);'],
      ['Strings', 'const s = "hello world";\ns.toUpperCase();\ns.split(" ");\ns.includes("world");'],
    ]],
    ['Maps and functions', [
      ['Count things', 'const count = new Map<string, number>();\nfor (const w of words) count.set(w, (count.get(w) ?? 0) + 1);'],
      ['Functions', 'function area(w: number, h = 1): number {\n  return w * h;\n}\n\nconst square = (x: number): number => x * x;'],
    ]],
  ]],
  Ruby: ['.rb', null, [
    ['Input and output', [
      ['Read numbers', 'n = gets.to_i\na, b = gets.split.map(&:to_i)\nline = gets.chomp   # drop the newline'],
      ['Print', 'puts a, b        # one per line\nputs "#{a} #{b}"\nprint "no newline"\nputs "%.2f" % x  # 2 decimals'],
    ]],
    ['Loops and conditions', [
      ['Loops', 'n.times { |i| puts i }\n\nnums.each_with_index { |x, i| puts "#{i} #{x}" }\n\n(1..5).each { |i| puts i }'],
      ['Conditions', 'if x > 0\n  puts "positive"\nelsif x == 0\n  puts "zero"\nelse\n  puts "negative"\nend\n\nlabel = x.even? ? "even" : "odd"'],
    ]],
    ['Arrays and strings', [
      ['Arrays', 'nums = [3, 1, 2]\nnums << 5\nnums.sort\nnums.sum\nevens = nums.select(&:even?)\nsquares = nums.map { |x| x * x }'],
      ['Strings', 's = "hello world"\ns.length\ns.upcase\ns.split\ns.reverse\ns.include?("lo")'],
    ]],
    ['Hashes and methods', [
      ['Count things', 'count = words.tally\n\ncount = Hash.new(0)\nwords.each { |w| count[w] += 1 }'],
      ['Methods', 'def area(w, h = 1)\n  w * h   # last line is returned\nend'],
    ]],
  ]],
  PHP: ['.php', null, [
    ['Input and output', [
      ['Read numbers', '<?php\n$n = (int) trim(fgets(STDIN));\n[$a, $b] = array_map(\'intval\', explode(\' \', trim(fgets(STDIN))));'],
      ['Print', 'echo "$a $b\\n";\necho $a . " " . $b . PHP_EOL;\nprintf("%.2f\\n", $x);   // 2 decimals'],
    ]],
    ['Loops and conditions', [
      ['Loops', 'for ($i = 0; $i < $n; $i++) {\n    echo $i, "\\n";\n}\n\nforeach ($nums as $i => $x) {\n    echo "$i $x\\n";\n}'],
      ['Conditions', 'if ($x > 0) echo "positive";\nelseif ($x == 0) echo "zero";\nelse echo "negative";\n\n$label = $x % 2 == 0 ? "even" : "odd";'],
    ]],
    ['Arrays and strings', [
      ['Arrays', '$nums = [3, 1, 2];\n$nums[] = 5;\nsort($nums);\necho array_sum($nums), count($nums);\n$evens = array_filter($nums, fn($x) => $x % 2 == 0);'],
      ['Strings', '$s = "hello world";\nstrlen($s);\nstrtoupper($s);\nexplode(" ", $s);\nstrrev($s);\nstr_contains($s, "lo");'],
    ]],
    ['Counting and functions', [
      ['Count things', '$count = array_count_values($words);\narsort($count);   // biggest first'],
      ['Functions', 'function area($w, $h = 1) {\n    return $w * $h;\n}\n\n$square = fn($x) => $x * $x;'],
    ]],
  ]],
  Swift: ['.swift', null, [
    ['Input and output', [
      ['Read numbers', 'let n = Int(readLine()!)!\nlet nums = readLine()!.split(separator: " ").map { Int($0)! }', 'The ! unwraps a value you know is there.'],
      ['Print', 'print(a, b)\nprint("\\(a) and \\(b)")\nprint(String(format: "%.2f", x))   // needs Foundation'],
    ]],
    ['Loops and conditions', [
      ['Loops', 'for i in 0..<n {     // 0 .. n-1\n    print(i)\n}\n\nfor (i, x) in nums.enumerated() {\n    print(i, x)\n}'],
      ['Conditions', 'if x > 0 {\n    print("positive")\n} else if x == 0 {\n    print("zero")\n} else {\n    print("negative")\n}'],
    ]],
    ['Arrays and strings', [
      ['Arrays', 'var nums = [3, 1, 2]\nnums.append(5)\nnums.sort()\nlet total = nums.reduce(0, +)\nlet evens = nums.filter { $0 % 2 == 0 }'],
      ['Strings', 'let s = "hello world"\ns.count\ns.uppercased()\ns.split(separator: " ")\nString(s.reversed())'],
    ]],
    ['Dictionaries and functions', [
      ['Count things', 'var count: [String: Int] = [:]\nfor w in words {\n    count[w, default: 0] += 1\n}'],
      ['Functions', 'func area(_ w: Int, _ h: Int = 1) -> Int {\n    return w * h\n}\n\nlet a = area(3, 4)   // 12'],
    ]],
  ]],
  SQL: ['.sql', null, [
    ['Reading data', [
      ['Select', 'SELECT name, score\nFROM students\nWHERE score >= 50\nORDER BY score DESC\nLIMIT 10;'],
      ['Filter', 'WHERE city IN (\'Pune\', \'Delhi\')\n  AND name LIKE \'A%\'        -- starts with A\n  AND score BETWEEN 40 AND 80\n  AND email IS NOT NULL'],
    ]],
    ['Grouping', [
      ['Aggregate', 'SELECT COUNT(*), AVG(score), MAX(score)\nFROM students;'],
      ['Group by', 'SELECT city, COUNT(*) AS total\nFROM students\nGROUP BY city\nHAVING COUNT(*) > 5;', 'WHERE filters rows, HAVING filters groups.'],
    ]],
    ['Joining tables', [
      ['Inner join', 'SELECT s.name, c.title\nFROM students s\nJOIN courses c ON c.id = s.course_id;'],
      ['Left join', 'SELECT s.name, c.title\nFROM students s\nLEFT JOIN courses c ON c.id = s.course_id;\n-- keeps students with no course'],
    ]],
    ['Changing data', [
      ['Insert and update', 'INSERT INTO students (name, score)\nVALUES (\'Ana\', 90);\n\nUPDATE students SET score = 95\nWHERE name = \'Ana\';'],
      ['Create table', 'CREATE TABLE students (\n  id INTEGER PRIMARY KEY,\n  name TEXT NOT NULL,\n  score INTEGER DEFAULT 0\n);'],
    ]],
  ]],
};

import re

with open('kilr-starting-template/css/kilr-starter-template.webflow.css', 'r') as f:
    content = f.read()

# 1. Replace the root variables definition block
root_vars_search = r"--fluid-flex---col-50: calc\(\(100% - \(2 - 1\) \* var\(--fluid-flex-gap\)\) \* \.5\);.*?--fluid-flex---col-16: calc\(\(100% - \(6 - 1\) \* var\(--fluid-flex-gap\)\) \* \.16667\);"
root_vars_replace = """--fluid-flex---col-1-of-1: 100%;
  --fluid-flex---col-1-of-2: calc((100% - 1 * var(--fluid-flex-gap)) / 2);
  --fluid-flex---col-1-of-3: calc((100% - 2 * var(--fluid-flex-gap)) / 3);
  --fluid-flex---col-2-of-3: calc((100% - 2 * var(--fluid-flex-gap)) * 0.66666667 + var(--fluid-flex-gap));
  --fluid-flex---col-1-of-4: calc((100% - 3 * var(--fluid-flex-gap)) / 4);
  --fluid-flex---col-2-of-4: calc((100% - 3 * var(--fluid-flex-gap)) * 0.5 + var(--fluid-flex-gap));
  --fluid-flex---col-3-of-4: calc((100% - 3 * var(--fluid-flex-gap)) * 0.75 + 2 * var(--fluid-flex-gap));
  --fluid-flex---col-1-of-5: calc((100% - 4 * var(--fluid-flex-gap)) / 5);
  --fluid-flex---col-2-of-5: calc((100% - 4 * var(--fluid-flex-gap)) * 0.4 + var(--fluid-flex-gap));
  --fluid-flex---col-3-of-5: calc((100% - 4 * var(--fluid-flex-gap)) * 0.6 + 2 * var(--fluid-flex-gap));
  --fluid-flex---col-4-of-5: calc((100% - 4 * var(--fluid-flex-gap)) * 0.8 + 3 * var(--fluid-flex-gap));
  --fluid-flex---col-1-of-6: calc((100% - 5 * var(--fluid-flex-gap)) / 6);
  --fluid-flex---col-5-of-6: calc((100% - 5 * var(--fluid-flex-gap)) * 0.83333333 + 4 * var(--fluid-flex-gap));"""
content = re.sub(root_vars_search, root_vars_replace, content, flags=re.DOTALL)

# 2. Replace the individual class definitions (e.g. .col-50 { width: var(--fluid-flex---col-50); })
classes_search = r"\.col-50 \{\s*width: var\(--fluid-flex---col-50\);\s*position: relative;\s*\}\s*\.row_gap-l.*?\.col-16 \{\s*width: var\(--fluid-flex---col-16\);\s*\}"
# We'll just replace the lines 250-285 separately since they are split around .row_gap
# Actually, let's just do a clean regex replacement for all .col-XX { width: ... } and flex: 1; where applicable
old_classes = ['50', '70', '60', '66', '30', '40', '33', '25', '20', '16']
for oc in old_classes:
    content = re.sub(r"\.col-" + oc + r"\s*\{\s*width:\s*var\(--fluid-flex---col-" + oc + r"\);\s*(position:\s*relative;\s*)?(flex:\s*1;\s*)?\}", "", content)

# Inject the new classes exactly where .col-50 used to be? No, let's just append them or put them where .container-xxl starts
new_classes = """
.col-1-of-1 { width: var(--fluid-flex---col-1-of-1); position: relative; }
.col-1-of-2 { width: var(--fluid-flex---col-1-of-2); position: relative; }
.col-1-of-3 { width: var(--fluid-flex---col-1-of-3); position: relative; }
.col-2-of-3 { width: var(--fluid-flex---col-2-of-3); position: relative; }
.col-1-of-4 { width: var(--fluid-flex---col-1-of-4); position: relative; }
.col-2-of-4 { width: var(--fluid-flex---col-2-of-4); position: relative; }
.col-3-of-4 { width: var(--fluid-flex---col-3-of-4); position: relative; }
.col-1-of-5 { width: var(--fluid-flex---col-1-of-5); position: relative; }
.col-2-of-5 { width: var(--fluid-flex---col-2-of-5); position: relative; }
.col-3-of-5 { width: var(--fluid-flex---col-3-of-5); position: relative; }
.col-4-of-5 { width: var(--fluid-flex---col-4-of-5); position: relative; }
.col-1-of-6 { width: var(--fluid-flex---col-1-of-6); position: relative; }
.col-5-of-6 { width: var(--fluid-flex---col-5-of-6); position: relative; }
"""
content = content.replace(".container-xxl {", new_classes + "\n.container-xxl {")

# 3. Replace the selector lists in media queries
selector_search = r"(\.col-70,\s*\.col-60,\s*\.col-66,\s*\.col-30,\s*\.col-40,\s*\.col-33,\s*\.col-25,\s*\.col-20,\s*\.col-16|\.col-50,\s*\.col-70,\s*\.col-60,\s*\.col-66,\s*\.col-30,\s*\.col-40,\s*\.col-33,\s*\.col-25,\s*\.col-20,\s*\.col-16)"
selector_replace = ".col-1-of-1, .col-1-of-2, .col-1-of-3, .col-2-of-3, .col-1-of-4, .col-2-of-4, .col-3-of-4, .col-1-of-5, .col-2-of-5, .col-3-of-5, .col-4-of-5, .col-1-of-6, .col-5-of-6"
content = re.sub(selector_search, selector_replace, content)

# 4. Replace 991px variables block (max-width: 991px)
max_991_search = r"--fluid-flex---col-50: 100%;\s*--fluid-flex---col-70: 100%;\s*--fluid-flex---col-60: 100%;\s*--fluid-flex---col-66: 100%;\s*--fluid-flex---col-30: 100%;\s*--fluid-flex---col-40: 100%;\s*--fluid-flex---col-33: calc\(\(100% - \(2 - 1\) \* var\(--fluid-flex-gap\)\) \* \.5\);\s*--fluid-flex---col-25: calc\(\(100% - \(2 - 1\) \* var\(--fluid-flex-gap\)\) \* \.5\);\s*--fluid-flex---col-20: calc\(\(100% - \(4 - 1\) \* var\(--fluid-flex-gap\)\) \* \.25\);\s*--fluid-flex---col-16: calc\(\(100% - \(4 - 1\) \* var\(--fluid-flex-gap\)\) \* \.25\);"
max_991_replace = """--fluid-flex---col-1-of-2: 100%;
    --fluid-flex---col-1-of-3: 100%;
    --fluid-flex---col-1-of-4: calc((100% - 1 * var(--fluid-flex-gap)) / 2);
    --fluid-flex---col-1-of-5: 100%;
    --fluid-flex---col-2-of-5: 100%;
    --fluid-flex---col-1-of-6: calc((100% - 1 * var(--fluid-flex-gap)) / 2);"""
content = re.sub(max_991_search, max_991_replace, content)

# 5. Replace 768px variables block (max-width: 767px)
max_767_search = r"--fluid-flex---col-50: 100%;\s*--fluid-flex---col-70: 100%;\s*--fluid-flex---col-60: 100%;\s*--fluid-flex---col-66: 100%;\s*--fluid-flex---col-30: 100%;\s*--fluid-flex---col-40: 100%;\s*--fluid-flex---col-33: 100%;\s*--fluid-flex---col-25: calc\(\(100% - \(2 - 1\) \* var\(--fluid-flex-gap\)\) \* \.5\);\s*--fluid-flex---col-20: calc\(\(100% - \(3 - 1\) \* var\(--fluid-flex-gap\)\) \* \.333333\);\s*--fluid-flex---col-16: calc\(\(100% - \(3 - 1\) \* var\(--fluid-flex-gap\)\) \* \.3334\);"
max_767_replace = """--fluid-flex---col-1-of-4: 100%;
    --fluid-flex---col-1-of-6: calc((100% - 1 * var(--fluid-flex-gap)) / 2);"""
content = re.sub(max_767_search, max_767_replace, content)

# 6. Replace 479px variables block (max-width: 479px)
max_479_search = r"--fluid-flex---col-50: 100%;\s*--fluid-flex---col-70: 100%;\s*--fluid-flex---col-60: 100%;\s*--fluid-flex---col-66: 100%;\s*--fluid-flex---col-30: 100%;\s*--fluid-flex---col-40: 100%;\s*--fluid-flex---col-33: 100%;\s*--fluid-flex---col-25: 100%;\s*--fluid-flex---col-20: calc\(\(100% - \(2 - 1\) \* var\(--fluid-flex-gap\)\) \* \.5\);\s*--fluid-flex---col-16: calc\(\(100% - \(2 - 1\) \* var\(--fluid-flex-gap\)\) \* \.5\);"
max_479_replace = """--fluid-flex---col-1-of-6: 100%;"""
content = re.sub(max_479_search, max_479_replace, content)

with open('kilr-starting-template/css/kilr-starter-template.webflow.css', 'w') as f:
    f.write(content)

print("CSS Refactored successfully.")

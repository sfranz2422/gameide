# script: levels
# Every level. Each tube is its sand from the bottom up, one letter a layer
# (COLOURS says which letter is which); "" is an empty tube. par is the fewest
# pours that finish it, and build.py checks that it's right and that the level
# can be finished at all. hidden: every layer but the top starts covered.
# Made by make_levels.py; to change a level, change it here and build.
CAP = 4
LEVELS = [
    {"name": "First Pour", "par": 3, "hidden": False, "tubes": ["RRRO", "OOOR", ""]},
    {"name": "Three Colours", "par": 8, "hidden": False, "tubes": ["OYYR", "RROY", "ROYO", "", ""]},
    {"name": "Tight Squeeze", "par": 8, "hidden": False, "tubes": ["RROY", "OOYO", "YRYR", ""]},
    {"name": "Sunset", "par": 12, "hidden": False, "tubes": ["ROGO", "ROOY", "YYGR", "GRYG", "", ""]},
    {"name": "Dune Sea", "par": 13, "hidden": False, "tubes": ["GYOR", "YRGY", "GORO", "ORGY", "", ""]},
    {"name": "Mirage", "par": 12, "hidden": False, "tubes": ["YGGO", "YROG", "GYOR", "RORY", ""]},
    {"name": "Five Jars", "par": 15, "hidden": False, "tubes": ["ROOR", "YGCG", "OCYR", "CYRO", "GYGC", "", ""]},
    {"name": "Oasis", "par": 16, "hidden": False, "tubes": ["GCGC", "RORY", "COYG", "OGRY", "RCYO", "", ""]},
    {"name": "Sandstorm", "par": 16, "hidden": False, "tubes": ["YRRO", "YGOY", "RCGC", "CRYO", "GOGC", ""]},
    {"name": "Caravan", "par": 18, "hidden": False, "tubes": ["ROBR", "OYGC", "BBGY", "BYOR", "GGOC", "YCRC", "", ""]},
    {"name": "Hourglass", "par": 20, "hidden": False, "tubes": ["YROG", "RBOC", "YOBG", "OCCB", "RYGY", "RGBC", "", ""]},
    {"name": "Camel Crossing", "par": 20, "hidden": False, "tubes": ["RBCY", "BGRY", "RCOG", "BCYO", "YORG", "GCOB", "", ""]},
    {"name": "Lost Ruins", "par": 22, "hidden": False, "tubes": ["BBCY", "OGRB", "OCPG", "PYGO", "COYG", "PPYR", "CRBR", "", ""]},
    {"name": "Scorpion Pass", "par": 23, "hidden": False, "tubes": ["PGBG", "PCPR", "OCBR", "YOBG", "CYYR", "YCGB", "ORPO", "", ""]},
    {"name": "Tall Order", "par": 24, "hidden": False, "tubes": ["CROR", "YBPO", "YBYG", "GYGB", "ROPB", "PCGC", "ROPC", "", ""]},
    {"name": "Night Sky", "par": 25, "hidden": False, "tubes": ["RCOB", "GYBG", "POCR", "OKKP", "PCRB", "CYBR", "YKYG", "KOPG", "", ""]},
    {"name": "Buried", "par": 15, "hidden": True, "tubes": ["CRCO", "RYGY", "OORY", "OGRC", "GCGY", "", ""]},
    {"name": "Under the Dunes", "par": 19, "hidden": True, "tubes": ["YCGB", "RGYO", "BCCR", "OYGO", "BBGO", "RYCR", "", ""]},
    {"name": "Tomb Dust", "par": 22, "hidden": True, "tubes": ["YROG", "OCBP", "BPBO", "YGCR", "CPOG", "GPRC", "BYYR", "", ""]},
    {"name": "Painted Canyon", "par": 27, "hidden": False, "tubes": ["PBOY", "ORCY", "RPCG", "PCOG", "CBYG", "GBOK", "RKPK", "BRKY", "", ""]},
    {"name": "Deep Digging", "par": 26, "hidden": True, "tubes": ["PRRB", "BOPY", "GOYG", "RKGY", "CPOC", "BYKC", "CKBP", "ORKG", "", ""]},
    {"name": "Rainbow Desert", "par": 30, "hidden": False, "tubes": ["OCGY", "RGKY", "CBGR", "PORB", "PKBC", "CYWK", "KWBO", "RWPY", "GOWP", "", ""]},
    {"name": "Nine Lives", "par": 29, "hidden": True, "tubes": ["CGCO", "YROK", "YRBP", "WWBK", "CROP", "PWYO", "YGPC", "GKBG", "RBKW", "", ""]},
    {"name": "The Grand Sort", "par": 34, "hidden": False, "tubes": ["PYCP", "RWNG", "BWCG", "YKPN", "ORGC", "RPYO", "KGKB", "YNON", "ROWC", "BKBW", "", ""]},
]

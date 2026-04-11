# Detecta o caminho do Python na venv (Windows/WSL)
VENV_BIN = .venv/Scripts/python
# Se estiver no Linux puro/WSL puro, mude para: VENV_BIN = .venv/bin/python

up:
	docker-compose up -d

# Atalho para rodar o projeto usando a venv sem precisar ativar
run:
	$(VENV_BIN) main.py $(project)

# Atalho para instalar dependências na venv
install:
	$(VENV_BIN) -m pip install -r requirements.txt

clean:
	rm -rf __pycache__ .venv

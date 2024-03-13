window.onload = () => {
    getJokeFromQueue()
}

function getJokeFromQueue() {
    let select = document.getElementById('types')
    let text = document.getElementById('text')
    let punchline = document.getElementById('punchline')

    fetch('/mod')
        .then(response => {
            if(response.status === 200) {
                return response.json()
            }else {
                throw new Error(response.statusText)
            }
        })
        .then(data => {
            fetch('/types')
            .then(response => response.json())
            .then(types => {
                select.innerHTML = ''

                types.forEach(type => {
                    select.innerHTML += `<option value=${type.id}>${type.name}</option>`
                })

                select.selectedIndex = data.type_id;
            })
            .catch(err => console.error(err))

            text.value = data.text
            punchline.value = data.punchline
        })
        .catch(err => console.error(err))
}

function toggleTypeInput() {
    const typeInput = document.getElementById('typeInput');
    if (typeInput.style.display === 'none') {
        typeInput.style.display = 'block';
    } else {
        typeInput.style.display = 'none';
        typeInput.value = ''
    }
}

function deleteJoke()   {
    location.reload();
}

function submitJoke(typeInput, type, text, punchline, moderator)   {
    let message

    if(typeInput)   {
        message = {
            joke: {
                id : 0,
                type_id: typeInput,
                text: text,
                punchline : punchline
            },
            moderator: moderator
        }
    }else {
        message = {
            joke: {
                id : 0,
                type_id: type,
                text: text,
                punchline : punchline
            },
            moderator: moderator
        }
    }

    fetch('/sub', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
        body: JSON.stringify({message: message})
    })
        .then(response => response.json())
        .then(data => console.log(data))
        .catch(err => console.error(err))
}


